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
import pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
              description: 'Get Common Data Set information for a specific college',
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
            },
            get_cds_content: {
              description: 'Get the full content of a stored CDS file',
              inputSchema: {
                type: 'object',
                properties: {
                  collegeName: {
                    type: 'string',
                    description: 'Name of the college'
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
          description: 'Get Common Data Set information for a specific college',
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
        {
          name: 'get_cds_content',
          description: 'Get the full content of a stored CDS file',
          inputSchema: {
            type: 'object',
            properties: {
              collegeName: {
                type: 'string',
                description: 'Name of the college',
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
          case 'get_cds_content':
            return await this.handleGetCdsContent(request.params.arguments);
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
      console.error('Error downloading CDS:', error);
      return null;
    }
  }

  private async handleSearchCollegeData(args: any) {
    console.error('MCP Server - Handling search request with args:', JSON.stringify(args, null, 2));
    if (!args.query || typeof args.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid query parameter');
    }

    const includeWebSearch = args.includeWebSearch !== false;
    const results: CollegeData[] = [];

    if (includeWebSearch) {
      try {
        // Search for college data sources
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          `${args.query} site:.edu "Common Data Set" filetype:pdf`
        )}`;
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        const $ = cheerio.load(response.data);
        const searchResults = $('.g');

        for (const element of searchResults.toArray()) {
          const title = $(element).find('h3').text();
          const url = $(element).find('a').attr('href');
          const description = $(element).find('.VwiC3b').text();

          if (title && url) {
            const cleanUrl = url.startsWith('/url?q=')
              ? url.substring(7, url.indexOf('&'))
              : url;

            const collegeData: CollegeData = {
              name: title,
              url: cleanUrl,
              description,
              lastUpdated: new Date().toISOString()
            };

            // Download and store the CDS file
            const storedFile = await this.downloadAndStoreCDS(collegeData);
            if (storedFile) {
              collegeData.storedFile = storedFile;
            }

            results.push(collegeData);
            this.colleges.set(title, collegeData);
          }
        }
      } catch (error) {
        console.error('Web search error:', error);
      }
    }

    console.error('MCP Server - Search results:', results);
    const formattedResults = results.map(result => ({
      name: result.name,
      url: result.url,
      description: result.description,
      hasStoredFile: !!result.storedFile
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            results: formattedResults
          })
        }
      ]
    };
  }

  private async handleGetCdsData(args: any) {
    if (!args.collegeName || typeof args.collegeName !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid college name parameter');
    }

    const college = this.colleges.get(args.collegeName);
    if (!college) {
      // If college not found in memory, try to search for it
      const searchResult = await this.handleSearchCollegeData({
        query: `${args.collegeName} Common Data Set`,
        includeWebSearch: true,
      });

      const searchData = JSON.parse(searchResult.content[0].text);
      if (searchData.results.length === 0) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `No CDS data found for college: ${args.collegeName}`
        );
      }
    }

    try {
      const college = this.colleges.get(args.collegeName);
      if (!college) {
        throw new Error('College data not found');
      }

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
      
      let sections;
      if (isPDF) {
        const data = await pdfParse(content);
        sections = this.parseCDSContent(data.text);
      } else {
        // Handle HTML content
        const $ = cheerio.load(content);
        sections = this.parseCDSContent($.text());
      }

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

  private async handleGetCdsContent(args: any) {
    if (!args.collegeName || typeof args.collegeName !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid college name parameter');
    }

    const college = this.colleges.get(args.collegeName);
    if (!college || !college.storedFile) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No stored CDS file found for college: ${args.collegeName}`
      );
    }

    try {
      const content = fs.readFileSync(college.storedFile);
      const isPDF = college.storedFile.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        const data = await pdfParse(content);
        return {
          content: [
            {
              type: 'text',
              text: data.text
            }
          ]
        };
      } else {
        // For HTML files, return the raw content
        return {
          content: [
            {
              type: 'text',
              text: content.toString()
            }
          ]
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error reading CDS content: ${error instanceof Error ? error.message : String(error)}`
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
