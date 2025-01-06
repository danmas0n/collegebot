#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

interface Student {
  id: string;
  name: string;
  lastUpdated: string;
  data: {
    studentProfile: {
      graduationYear?: number;
      highSchool?: string;
      gpa?: number;
      satScore?: number;
      actScore?: number;
      extracurriculars?: string[];
      sports?: string[];
    };
    collegeInterests: {
      colleges?: string[];
      majors?: string[];
      fieldsOfStudy?: string[];
    };
    budgetInfo: {
      yearlyBudget?: number;
      willingness?: {
        loans?: boolean;
        workStudy?: boolean;
        scholarships?: boolean;
      };
    };
    dataCollection?: {
      status: 'pending' | 'in-progress' | 'complete';
      progress?: number;
    };
    recommendations?: {
      colleges: Array<{
        name: string;
        reason: string;
        fitScore: number;
      }>;
      scholarships?: Array<{
        name: string;
        amount: number;
        deadline: string;
        eligibility: string;
      }>;
    };
  };
}

class StudentDataServer {
  private server: Server;
  private dataPath: string;

  constructor() {
    this.server = new Server(
      {
        name: 'student-data-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            get_students: {
              description: 'Get all student profiles',
              inputSchema: {}
            },
            save_student: {
              description: 'Save or update a student profile',
              inputSchema: {
                type: 'object',
                properties: {
                  student: {
                    type: 'object',
                    required: ['id', 'name', 'lastUpdated', 'data']
                  }
                },
                required: ['student']
              }
            },
            delete_student: {
              description: 'Delete a student profile',
              inputSchema: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Student ID to delete'
                  }
                },
                required: ['id']
              }
            }
          }
        },
      }
    );

    // Store data in the user's home directory
    this.dataPath = path.join(process.env.HOME || '', '.collegebot', 'students.json');

    this.setupToolHandlers();
    
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async ensureDataFile() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      try {
        await fs.access(this.dataPath);
      } catch {
        await fs.writeFile(this.dataPath, JSON.stringify({ students: [] }));
      }
    } catch (error) {
      console.error('Error ensuring data file exists:', error);
      throw error;
    }
  }

  private async readData(): Promise<{ students: Student[] }> {
    await this.ensureDataFile();
    const data = await fs.readFile(this.dataPath, 'utf-8');
    return JSON.parse(data);
  }

  private async writeData(data: { students: Student[] }) {
    await this.ensureDataFile();
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_students':
          try {
            const data = await this.readData();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data.students),
                },
              ],
            };
          } catch (error) {
            console.error('Error reading students:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to read student data');
          }

        case 'save_student': {
          const args = request.params.arguments;
          if (!args || typeof args !== 'object' || !('student' in args)) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing student data');
          }
          const student = args.student as Student;
          if (!student?.id || !student?.name) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid student data');
          }

          try {
            const data = await this.readData();
            const index = data.students.findIndex(s => s.id === student.id);
            
            if (index >= 0) {
              data.students[index] = student;
            } else {
              data.students.push(student);
            }

            await this.writeData(data);
            return {
              content: [{ type: 'text', text: 'Student saved successfully' }],
            };
          } catch (error) {
            console.error('Error saving student:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to save student data');
          }
        }

        case 'delete_student': {
          const args = request.params.arguments;
          if (!args || typeof args !== 'object' || !('id' in args)) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing student ID');
          }
          const { id } = args;
          if (typeof id !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID is required');
          }

          try {
            const data = await this.readData();
            data.students = data.students.filter(s => s.id !== id);
            await this.writeData(data);
            return {
              content: [{ type: 'text', text: 'Student deleted successfully' }],
            };
          } catch (error) {
            console.error('Error deleting student:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to delete student');
          }
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Student Data MCP server running on stdio');
  }
}

const server = new StudentDataServer();
server.run().catch(console.error);
