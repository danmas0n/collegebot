#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import PDFParser from 'pdf2json';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Google Custom Search configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
  throw new Error('Google API key and Custom Search Engine ID are required');
}

const GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

interface CollegeData {
  name: string;
  url: string;
  cdsUrl?: string;
  description?: string;
  dataPoints?: Record<string, any>;
  storedFile?: string;
  lastUpdated?: string;
}

class CollegeDataServer {
  private server: Server;
  private colleges: Map<string, CollegeData> = new Map();

  constructor() {
    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    this.server = new Server(
      {
        name: 'college-data-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {
            search_college_data: {
              description: 'Search for college data sources and information',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for college data'
                  },
                  includeWebSearch: {
                    type: 'boolean',
                    description: 'Whether to include web search results',
                    default: true
                  }
                },
                required: ['query']
              }
            },
            get_cds_data: {
              description: 'Get Common Data Set information and full content for a specific college',
              inputSchema: {
                type: 'object',
                properties: {
                  collegeName: {
                    type: 'string',
                    description: 'Name of the college'
                  },
                  year: {
                    type: 'string',
                    description: 'Academic year (e.g., "2022-2023")'
                  }
                },
                required: ['collegeName']
              }
            }
          }
        }
      }
    );

    // Set up tool handlers
    this.setupToolHandlers();

    // Set up resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "college://search",
            name: "College Search",
            description: "Search for colleges and their Common Data Set information"
          }
        ]
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri === "college://search") {
        const results = await this.handleSearchCollegeData({
          query: request.params.query || "",
          includeWebSearch: true
        });
        return {
          contents: [
            {
              uri: "college://search",
              mimeType: "application/json",
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      } else {
        throw new McpError(ErrorCode.InvalidRequest, "Resource not found");
      }
    });
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_college_data',
          description: 'Search for college data sources and information',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for college data',
              },
              includeWebSearch: {
                type: 'boolean',
                description: 'Whether to include web search results',
                default: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_cds_data',
          description: 'Get Common Data Set information and full content for a specific college',
          inputSchema: {
            type: 'object',
            properties: {
              collegeName: {
                type: 'string',
                description: 'Name of the college',
              },
              year: {
                type: 'string',
                description: 'Academic year (e.g., "2022-2023")',
              },
            },
            required: ['collegeName'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('MCP Server - Received tool request:', JSON.stringify(request, null, 2));
      try {
        switch (request.params.name) {
          case 'search_college_data':
            return await this.handleSearchCollegeData(request.params.arguments);
          case 'get_cds_data':
            return await this.handleGetCdsData(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  private async downloadAndStoreCDS(college: CollegeData): Promise<string | null> {
    try {
      const response = await axios.get(college.url, {
        responseType: 'arraybuffer',
      });

      const contentType = response.headers['content-type'];
      const isHTML = contentType?.includes('text/html');
      const isPDF = contentType?.includes('application/pdf');

      if (!isHTML && !isPDF) {
        console.error('Unsupported content type:', contentType);
        return null;
      }

      const filename = path.join(
        STORAGE_DIR,
        `${college.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${isHTML ? 'html' : 'pdf'}`
      );

      fs.writeFileSync(filename, response.data);
      return filename;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error downloading CDS:', error.message.slice(0, 1000));
      } else {
        console.error('Error downloading CDS:', String(error).slice(0, 1000));
      }
      return null;
    }
  }

  private async searchCDSFiles(query: string): Promise<CollegeData[]> {
    try {
      const searchResponse = await axios.get(GOOGLE_SEARCH_API, {
        params: {
          key: GOOGLE_API_KEY,
          cx: GOOGLE_CSE_ID,
          q: `${query} site:.edu "Common Data Set" filetype:pdf`,
          num: 10
        }
      });

      const results: CollegeData[] = [];
      if (searchResponse.data.items) {
        for (const item of searchResponse.data.items) {
          if (item.title && item.link) {
            const collegeData: CollegeData = {
              name: item.title,
              url: item.link,
              description: item.snippet || '',
              lastUpdated: new Date().toISOString()
            };

            const storedFile = await this.downloadAndStoreCDS(collegeData);
            if (storedFile) {
              collegeData.storedFile = storedFile;
            }

            results.push(collegeData);
            this.colleges.set(item.title, collegeData);
          }
        }
      }
      return results;
    } catch (error) {
      console.error('Google Custom Search error:', error);
      if (error instanceof Error) {
        throw new McpError(ErrorCode.InternalError, `CDS search failed: ${error.message}`);
      }
      return [];
    }
  }

  private async handleSearchCollegeData(args: any) {
    console.error('MCP Server - Handling search request with args:', JSON.stringify(args, null, 2));
    if (!args.query || typeof args.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid query parameter');
    }

    try {
      // Use Google Custom Search API for general college information
      const searchResponse = await axios.get(GOOGLE_SEARCH_API, {
        params: {
          key: GOOGLE_API_KEY,
          cx: GOOGLE_CSE_ID,
          q: args.query,
          num: 10
        }
      });

      const results = searchResponse.data.items?.map((item: any) => ({
        title: item.title,
        url: item.link,
        description: item.snippet || '',
        source: new URL(item.link).hostname
      })) || [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              results
            })
          }
        ]
      };
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof Error) {
        throw new McpError(ErrorCode.InternalError, `Search failed: ${error.message}`);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              results: []
            })
          }
        ]
      };
    }
  }

  private async handleGetCdsData(args: any) {
    if (!args.collegeName || typeof args.collegeName !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid college name parameter');
    }

    // First try to find college in memory
    let college = this.colleges.get(args.collegeName);
    
    // If not in memory, try to find existing stored file
    if (!college) {
      const files = fs.readdirSync(STORAGE_DIR);
      const collegeFilePattern = new RegExp(`^${args.collegeName.replace(/[^a-zA-Z0-9]/g, '_')}_\\d+\\.(pdf|html)$`);
      const matchingFiles = files.filter(f => collegeFilePattern.test(f));
      
      if (matchingFiles.length > 0) {
        // Use most recent file based on timestamp in filename
        const mostRecentFile = matchingFiles.sort().pop()!;
        college = {
          name: args.collegeName,
          url: '', // URL not available for restored entries
          storedFile: path.join(STORAGE_DIR, mostRecentFile),
          lastUpdated: new Date().toISOString()
        };
        this.colleges.set(args.collegeName, college);
      } else {
        // If no stored file, try to search for new CDS files
        const results = await this.searchCDSFiles(args.collegeName);
        if (results.length === 0) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No CDS data found for college: ${args.collegeName}`
          );
        }
        college = results[0]; // Use the first result
      }
    }

    try {
      let content: Buffer;
      if (college.storedFile) {
        content = fs.readFileSync(college.storedFile);
      } else {
        const response = await axios.get(college.url, {
          responseType: 'arraybuffer',
        });
        content = Buffer.from(response.data);
        
        // Store for future use
        const storedFile = await this.downloadAndStoreCDS(college);
        if (storedFile) {
          college.storedFile = storedFile;
          this.colleges.set(args.collegeName, college);
        }
      }

      // Parse content based on file type
      const isPDF = college.url.toLowerCase().endsWith('.pdf') || 
                   college.storedFile?.toLowerCase().endsWith('.pdf');
      
      let fullText: string;
      let sections;

      if (isPDF) {
        const pdfParser = new PDFParser();
        fullText = await new Promise<string>((resolve, reject) => {
          pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            const pages = pdfData.Pages || [];
            const text = pages.map((page: any) => {
              const texts = page.Texts || [];
              return texts.map((text: any) => {
                const runs = text.R || [];
                return runs.map((r: any) => r.T || '').join(' ');
              }).join(' ');
            }).join('\n');
            resolve(decodeURIComponent(text));
          });
          pdfParser.on('pdfParser_dataError', reject);
          pdfParser.parseBuffer(content);
        });
      } else {
        // Handle HTML content
        const $ = cheerio.load(content);
        fullText = $.text();
      }

      // Parse sections from the full text
      sections = this.parseCDSContent(fullText);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                collegeName: args.collegeName,
                year: args.year || 'latest',
                url: college.url,
                sections,
                fullText,
                hasStoredFile: !!college.storedFile
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: unknown) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error fetching CDS data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseCDSContent(text: string) {
    return {
      admissions: this.extractSection(text, /B\. ENROLLMENT AND PERSISTENCE[\s\S]*?C\. FIRST-TIME/i),
      enrollment: this.extractSection(text, /C\. FIRST-TIME[\s\S]*?D\. TRANSFER/i),
      expenses: this.extractSection(text, /G\. ANNUAL EXPENSES[\s\S]*?H\. FINANCIAL AID/i),
      financialAid: this.extractSection(text, /H\. FINANCIAL AID[\s\S]*?I\. INSTRUCTIONAL/i)
    };
  }

  private extractSection(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match ? match[0].trim() : '';
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('College Data MCP server running on stdio');
  }
}

const server = new CollegeDataServer();
server.run().catch(console.error);
