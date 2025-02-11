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
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { GeminiService } from './services/gemini.js';

// Google API configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GOOGLE_SEARCH_API = 'https://www.googleapis.com/customsearch/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
  throw new Error('GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables are required');
}

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

console.error('Using Gemini model:', GEMINI_MODEL);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'storage');
const CACHE_DIR = path.join(__dirname, '..', 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface CollegeData {
  name: string;
  years: { [year: string]: { 
    filename: string;
    format: 'pdf' | 'xlsx';
  }}; 
}

interface CDSData {
  admissions?: string[];
  expenses?: string[];
  financialAid?: string[];
  rawData?: any;
  [key: string]: any; // Allow string indexing
}

interface ParsedCDSData extends CDSData {
  metadata: {
    collegeName: string;
    year: string;
    format: 'pdf' | 'xlsx';
    lastUpdated: string;
  };
}

function getCacheFilePath(collegeName: string, year: string): string {
  return path.join(CACHE_DIR, `${collegeName.replace(/\s+/g, '_')}_${year}.json`);
}

function checkCache(collegeName: string, year: string): ParsedCDSData | null {
  const cacheFile = getCacheFilePath(collegeName, year);
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return cached;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }
  return null;
}

function saveToCache(data: ParsedCDSData): void {
  const cacheFile = getCacheFilePath(data.metadata.collegeName, data.metadata.year);
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}


class CollegeDataServer {
  private server: Server;
  private collegeMap: Map<string, CollegeData> = new Map();

  constructor() {
    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Initialize college map from storage directory
    this.initializeCollegeMap();

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
              description: 'Search for available college data',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for college data'
                  }
                },
                required: ['query']
              }
            },
            get_cds_data: {
              description: 'Get Common Data Set information for a specific college and year',
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

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private initializeCollegeMap() {
    const files = fs.readdirSync(STORAGE_DIR);
    
    for (const file of files) {
      // Support both xlsx and pdf files
      if (!file.endsWith('.xlsx') && !file.endsWith('.pdf')) continue;

      // Parse filename to get college name and year
      // Format: College_Name_YYYY-YY.(xlsx|pdf)
      const match = file.match(/(.+)_(\d{4}-\d{2})\.(xlsx|pdf)$/);
      if (!match) continue;

      const [_, collegeName, year, ext] = match;
      const normalizedName = collegeName.replace(/_/g, ' ');
      
      const collegeData = this.collegeMap.get(normalizedName) || {
        name: normalizedName,
        years: {}
      };
      
      collegeData.years[year] = {
        filename: file,
        format: ext as 'pdf' | 'xlsx'
      };
      
      this.collegeMap.set(normalizedName, collegeData);
    }

    console.error('Initialized college map with', this.collegeMap.size, 'colleges');
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_college_data',
          description: 'Search for available college data',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for college data',
              }
            },
            required: ['query'],
          },
        },
        {
          name: 'get_cds_data',
          description: 'Get Common Data Set information for a specific college and year',
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

    const college = this.collegeMap.get(args.collegeName);
    if (!college) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                collegeName: args.collegeName,
                error: 'No data available for this college'
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // If year is not specified, use the most recent year
    const year = args.year || Object.keys(college.years).sort().pop();
    const fileInfo = college.years[year];
    
    if (!fileInfo) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                collegeName: args.collegeName,
                error: `No data available for year ${year}`
              },
              null,
              2
            ),
          },
        ],
      };
    }

    try {
      // Check cache first
      const cached = checkCache(args.collegeName, year);
      if (cached) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cached, null, 2),
            },
          ],
        };
      }

      // Parse if not in cache
      const filePath = path.join(STORAGE_DIR, fileInfo.filename);
      const gemini = new GeminiService(GEMINI_API_KEY!, GEMINI_MODEL);
      const sections = await gemini.parseCDSFile(filePath, fileInfo.format);

      // Create parsed data with metadata
      const parsedData: ParsedCDSData = {
        ...sections,
        metadata: {
          collegeName: args.collegeName,
          year,
          format: fileInfo.format,
          lastUpdated: new Date().toISOString()
        }
      };

      // Save to cache
      saveToCache(parsedData);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(parsedData, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error reading CDS data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('College Data MCP server running on stdio');
  }
}

const server = new CollegeDataServer();
server.run().catch(console.error);
