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

interface CollegeData {
  name: string;
  url: string;
  cdsUrl?: string;
  description?: string;
  dataPoints?: Record<string, any>;
}

class CollegeDataServer {
  private server: Server;
  private colleges: Map<string, CollegeData> = new Map();

  constructor() {
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

        searchResults.each((_, element) => {
          const title = $(element).find('h3').text();
          const url = $(element).find('a').attr('href');
          const description = $(element).find('.VwiC3b').text();

          if (title && url) {
            results.push({
              name: title,
              url: url.startsWith('/url?q=')
                ? url.substring(7, url.indexOf('&'))
                : url,
              description,
            });

            // Store in memory for later use
            this.colleges.set(title, {
              name: title,
              url: url.startsWith('/url?q=')
                ? url.substring(7, url.indexOf('&'))
                : url,
              description,
            });
          }
        });
      } catch (error) {
        console.error('Web search error:', error);
      }
    }

    console.error('MCP Server - Search results:', results);
    const formattedResults = results.map(result => ({
      name: result.name,
      url: result.url,
      description: result.description
    }));
    console.error('MCP Server - Formatted results:', formattedResults);
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
      // Fetch the PDF file
      const college = this.colleges.get(args.collegeName);
      if (!college?.url) {
        throw new Error('College URL not found');
      }

      const response = await axios.get(college.url, {
        responseType: 'arraybuffer',
      });

      // For now, return the college info without PDF parsing
      // We'll implement PDF parsing in a future update
      const sections = {
        admissions: "PDF parsing coming soon",
        enrollment: "PDF parsing coming soon",
        expenses: "PDF parsing coming soon",
        financialAid: "PDF parsing coming soon"
      };

      return {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  collegeName: args.collegeName,
                  year: args.year || 'latest',
                  url: college.url,
                  sections,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    } catch (error: unknown) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error fetching CDS data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
