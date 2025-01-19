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

interface ChatMessage {
  role: 'user' | 'assistant' | 'thinking';
  content: string;
  toolData?: string;
  timestamp: string;
}

interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  studentId: string;
}

interface Student {
  id: string;
  name: string;
  lastUpdated: string;
  processedChats?: Record<string, {
    processedAt: string;
    lastMessageTimestamp: string;
  }>;
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
  private studentsPath: string;
  private chatsPath: string;

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
              inputSchema: { type: 'object', properties: {} as { [key: string]: never } }
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
            },
            get_chats: {
              description: 'Get all chats for a student',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  }
                },
                required: ['studentId']
              }
            },
            save_chat: {
              description: 'Save or update a chat',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  chat: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      messages: { type: 'array' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' }
                    },
                    required: ['id', 'title', 'messages', 'createdAt', 'updatedAt']
                  }
                },
                required: ['studentId', 'chat']
              }
            },
            delete_chat: {
              description: 'Delete a chat',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  chatId: {
                    type: 'string',
                    description: 'Chat ID'
                  }
                },
                required: ['studentId', 'chatId']
              }
            },
            mark_chat_processed: {
              description: 'Mark a chat as processed',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  chatId: {
                    type: 'string',
                    description: 'Chat ID'
                  },
                  lastMessageTimestamp: {
                    type: 'string',
                    description: 'Timestamp of last processed message'
                  }
                },
                required: ['studentId', 'chatId', 'lastMessageTimestamp']
              }
            }
          }
        },
      }
    );

    // Store data in the user's home directory
    const basePath = path.join(process.env.HOME || '', '.collegebot');
    this.studentsPath = path.join(basePath, 'students.json');
    this.chatsPath = path.join(basePath, 'chats.json');

    this.setupToolHandlers();
    
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async ensureDataFiles() {
    try {
      const baseDir = path.dirname(this.studentsPath);
      await fs.mkdir(baseDir, { recursive: true });
      
      try {
        await fs.access(this.studentsPath);
      } catch {
        await fs.writeFile(this.studentsPath, JSON.stringify({ students: [] }));
      }

      try {
        await fs.access(this.chatsPath);
      } catch {
        await fs.writeFile(this.chatsPath, JSON.stringify({ chats: [] }));
      }
    } catch (error) {
      console.error('Error ensuring data files exist:', error);
      throw error;
    }
  }

  private async readStudents(): Promise<{ students: Student[] }> {
    await this.ensureDataFiles();
    const data = await fs.readFile(this.studentsPath, 'utf-8');
    return JSON.parse(data);
  }

  private async writeStudents(data: { students: Student[] }) {
    await this.ensureDataFiles();
    await fs.writeFile(this.studentsPath, JSON.stringify(data, null, 2));
  }

  private async readChats(): Promise<{ chats: Chat[] }> {
    await this.ensureDataFiles();
    const data = await fs.readFile(this.chatsPath, 'utf-8');
    return JSON.parse(data);
  }

  private async writeChats(data: { chats: Chat[] }) {
    await this.ensureDataFiles();
    await fs.writeFile(this.chatsPath, JSON.stringify(data, null, 2));
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_students':
          try {
            const data = await this.readStudents();
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
            const data = await this.readStudents();
            const index = data.students.findIndex(s => s.id === student.id);
            
            if (index >= 0) {
              data.students[index] = student;
            } else {
              data.students.push(student);
            }

            await this.writeStudents(data);
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
            // Delete student
            const studentData = await this.readStudents();
            studentData.students = studentData.students.filter(s => s.id !== id);
            await this.writeStudents(studentData);

            // Delete associated chats
            const chatData = await this.readChats();
            chatData.chats = chatData.chats.filter(c => c.studentId !== id);
            await this.writeChats(chatData);

            return {
              content: [{ type: 'text', text: 'Student and associated chats deleted successfully' }],
            };
          } catch (error) {
            console.error('Error deleting student:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to delete student');
          }
        }

        case 'get_chats': {
          const args = request.params.arguments;
          if (!args?.studentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID is required');
          }

          try {
            const studentData = await this.readStudents();
            const student = studentData.students.find(s => s.id === args.studentId);
            if (!student) {
              throw new McpError(ErrorCode.InvalidParams, 'Student not found');
            }

            const data = await this.readChats();
            const studentChats = data.chats.filter(c => c.studentId === args.studentId);
            
            // Add processed status to each chat
            const chatsWithStatus = studentChats.map(chat => ({
              ...chat,
              processed: student.processedChats?.[chat.id] ? {
                processedAt: student.processedChats[chat.id].processedAt,
                lastMessageTimestamp: student.processedChats[chat.id].lastMessageTimestamp
              } : null
            }));

            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify(chatsWithStatus)
              }],
            };
          } catch (error) {
            console.error('Error getting chats:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to get chats');
          }
        }

        case 'save_chat': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.chat) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID and chat are required');
          }

          // Type check the chat object
          const chat = args.chat as Chat;
          if (!chat.id || !chat.title || !Array.isArray(chat.messages) || 
              !chat.createdAt || !chat.updatedAt) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid chat data');
          }

          try {
            const data = await this.readChats();
            const chatIndex = data.chats.findIndex(c => c.id === chat.id);

            // Add studentId to chat
            // Ensure studentId is a string
            const chatWithStudent: Chat = {
              ...chat,
              studentId: args.studentId as string
            };

            if (chatIndex >= 0) {
              data.chats[chatIndex] = chatWithStudent;
            } else {
              data.chats.push(chatWithStudent);
            }

            await this.writeChats(data);
            return {
              content: [{ type: 'text', text: 'Chat saved successfully' }],
            };
          } catch (error) {
            console.error('Error saving chat:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to save chat');
          }
        }

        case 'delete_chat': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.chatId) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID and chat ID are required');
          }

          try {
            const data = await this.readChats();
            data.chats = data.chats.filter(c => !(c.id === args.chatId && c.studentId === args.studentId));
            await this.writeChats(data);

            return {
              content: [{ type: 'text', text: 'Chat deleted successfully' }],
            };
          } catch (error) {
            console.error('Error deleting chat:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to delete chat');
          }
        }

        case 'mark_chat_processed': {
            const args = request.params.arguments;
            if (!args?.studentId || !args?.chatId || !args?.lastMessageTimestamp) {
              throw new McpError(ErrorCode.InvalidParams, 'Student ID, chat ID, and timestamp are required');
            }

            try {
              const studentData = await this.readStudents();
              const studentIndex = studentData.students.findIndex(s => s.id === args.studentId);
              if (studentIndex === -1) {
                throw new McpError(ErrorCode.InvalidParams, 'Student not found');
              }

              // Initialize or get processedChats
              const processedChats: Record<string, {
                processedAt: string;
                lastMessageTimestamp: string;
              }> = studentData.students[studentIndex].processedChats || {};

              // Update processed status
              processedChats[args.chatId as string] = {
                processedAt: new Date().toISOString(),
                lastMessageTimestamp: args.lastMessageTimestamp as string
              };

              // Update student data
              studentData.students[studentIndex].processedChats = processedChats;
              await this.writeStudents(studentData);
              return {
                content: [{ type: 'text', text: 'Chat marked as processed' }],
              };
            } catch (error) {
              console.error('Error marking chat as processed:', error);
              throw new McpError(ErrorCode.InternalError, 'Failed to mark chat as processed');
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
