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
import axios from 'axios';

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
  processed?: boolean;
  processedAt?: string;
}

interface MapLocation {
  id: string;
  type: 'college' | 'scholarship';
  name: string;
  latitude: number;
  longitude: number;
  sourceChats?: string[]; // IDs of chats that mentioned this location
  metadata: {
    website?: string;
    description?: string;
    address?: string;
    // College-specific metadata
    fitScore?: number;
    reason?: string;
    // Scholarship-specific metadata
    amount?: number;
    deadline?: string;
    eligibility?: string;
  };
}

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
    map?: {
      locations: MapLocation[];
    };
  };
}

class StudentDataServer {
  private server: Server;
  private studentsPath: string;
  private chatsPath: string;
  private mapLocationsPath: string;

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
            geocode: {
              description: 'Geocode an address to get latitude and longitude coordinates',
              inputSchema: {
                type: 'object',
                properties: {
                  address: {
                    type: 'string',
                    description: 'The address to geocode'
                  },
                  name: {
                    type: 'string',
                    description: 'Name of the location'
                  }
                },
                required: ['address', 'name']
              }
            },
            create_map_location: {
              description: 'Add a location to the student map data',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  location: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string', enum: ['college', 'scholarship'] },
                      name: { type: 'string' },
                      latitude: { type: 'number' },
                      longitude: { type: 'number' },
                      metadata: {
                        type: 'object',
                        properties: {
                          website: { type: 'string' },
                          description: { type: 'string' },
                          address: { type: 'string' },
                          fitScore: { type: 'number' },
                          reason: { type: 'string' },
                          amount: { type: 'number' },
                          deadline: { type: 'string' },
                          eligibility: { type: 'string' }
                        }
                      }
                    },
                    required: ['id', 'type', 'name', 'latitude', 'longitude']
                  }
                },
                required: ['studentId', 'location']
              }
            },
            get_map_locations: {
              description: 'Get all map locations for a student',
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
            clear_map_locations: {
              description: 'Clear all map locations for a student',
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
            list_map_location_names: {
              description: 'Get a lightweight list of existing map location names and types for a student',
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
            get_map_location_details: {
              description: 'Get full details for a specific map location by name and type',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  name: {
                    type: 'string',
                    description: 'Location name'
                  },
                  type: {
                    type: 'string',
                    enum: ['college', 'scholarship'],
                    description: 'Location type'
                  }
                },
                required: ['studentId', 'name', 'type']
              }
            },
            update_map_location: {
              description: 'Update an existing map location with new data',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  locationId: {
                    type: 'string',
                    description: 'Location ID to update'
                  },
                  updates: {
                    type: 'object',
                    description: 'Partial updates to apply to the location'
                  }
                },
                required: ['studentId', 'locationId', 'updates']
              }
            },
            create_calendar_item: {
              description: 'Create a calendar event for the student',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  item: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      date: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string' }
                    },
                    required: ['title', 'date']
                  }
                },
                required: ['studentId', 'item']
              }
            },
            create_task: {
              description: 'Create a task for the student',
              inputSchema: {
                type: 'object',
                properties: {
                  studentId: {
                    type: 'string',
                    description: 'Student ID'
                  },
                  task: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      dueDate: { type: 'string' },
                      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                      category: { type: 'string', enum: ['application', 'scholarship', 'financial', 'other'] }
                    },
                    required: ['title', 'dueDate', 'category']
                  }
                },
                required: ['studentId', 'task']
              }
            },
            update_plan: {
              description: 'Update a plan with new timeline items',
              inputSchema: {
                type: 'object',
                properties: {
                  planId: {
                    type: 'string',
                    description: 'ID of the plan to update'
                  },
                  timelineItems: {
                    type: 'array',
                    description: 'Array of timeline items to add to the plan'
                  }
                },
                required: ['planId', 'timelineItems']
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
    this.mapLocationsPath = path.join(basePath, 'map_locations.json');

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

      try {
        await fs.access(this.mapLocationsPath);
      } catch {
        await fs.writeFile(this.mapLocationsPath, JSON.stringify({ locations: [] }));
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

  private async readMapLocations(): Promise<{ locations: MapLocation[] }> {
    await this.ensureDataFiles();
    const data = await fs.readFile(this.mapLocationsPath, 'utf-8');
    return JSON.parse(data);
  }

  private async writeMapLocations(data: { locations: MapLocation[] }) {
    await this.ensureDataFiles();
    await fs.writeFile(this.mapLocationsPath, JSON.stringify(data, null, 2));
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
            const data = await this.readChats();
            const studentChats = data.chats.filter(c => c.studentId === args.studentId);
            
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify(studentChats)
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

        case 'geocode': {
          const args = request.params.arguments;
          if (!args?.address || !args?.name) {
            throw new McpError(ErrorCode.InvalidParams, 'Address and name are required');
          }

          try {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
              throw new Error('Google Maps API key not configured');
            }

            const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
              params: {
                address: args.address,
                key: apiKey
              }
            });

            if (response.data.status !== 'OK') {
              throw new Error(`Geocoding failed: ${response.data.status}`);
            }

            const location = response.data.results[0].geometry.location;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  name: args.name,
                  latitude: location.lat,
                  longitude: location.lng,
                  formattedAddress: response.data.results[0].formatted_address
                })
              }]
            };
          } catch (error) {
            console.error('Error geocoding address:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to geocode address');
          }
        }

        case 'create_map_location': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.location) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID and location are required');
          }

          try {
            const studentData = await this.readStudents();
            const studentIndex = studentData.students.findIndex(s => s.id === args.studentId);
            if (studentIndex === -1) {
              throw new McpError(ErrorCode.InvalidParams, 'Student not found');
            }

            // Initialize map data if it doesn't exist
            if (!studentData.students[studentIndex].data.map) {
              studentData.students[studentIndex].data.map = { locations: [] };
            }

            // Check if location already exists
            const location = args.location as MapLocation;
            const existingLocationIndex = studentData.students[studentIndex].data.map!.locations.findIndex(
              loc => loc.name === location.name && loc.type === location.type
            );

            if (existingLocationIndex !== -1) {
              // Update existing location
              studentData.students[studentIndex].data.map!.locations[existingLocationIndex] = location;
            } else {
              // Add new location
              studentData.students[studentIndex].data.map!.locations.push(location);
            }

            await this.writeStudents(studentData);
            return {
              content: [{ type: 'text', text: 'Location added successfully' }],
            };
          } catch (error) {
            console.error('Error creating map location:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to create map location');
          }
        }

        case 'clear_map_locations': {
          const args = request.params.arguments;
          if (!args?.studentId) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID is required');
          }

          try {
            const studentData = await this.readStudents();
            const studentIndex = studentData.students.findIndex(s => s.id === args.studentId);
            if (studentIndex === -1) {
              throw new McpError(ErrorCode.InvalidParams, 'Student not found');
            }

            // Clear map locations
            if (studentData.students[studentIndex].data.map) {
              studentData.students[studentIndex].data.map.locations = [];
            }

            await this.writeStudents(studentData);
            return {
              content: [{ type: 'text', text: 'Map locations cleared successfully' }],
            };
          } catch (error) {
            console.error('Error clearing map locations:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to clear map locations');
          }
        }

        case 'get_map_locations': {
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

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(student.data.map?.locations || [])
              }]
            };
          } catch (error) {
            console.error('Error getting map locations:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to get map locations');
          }
        }

        case 'list_map_location_names': {
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

            const locations = student.data.map?.locations || [];
            const locationNames = locations.map(loc => ({
              name: loc.name,
              type: loc.type,
              id: loc.id
            }));

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(locationNames)
              }]
            };
          } catch (error) {
            console.error('Error listing map location names:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to list map location names');
          }
        }

        case 'get_map_location_details': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.name || !args?.type) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID, name, and type are required');
          }

          try {
            const studentData = await this.readStudents();
            const student = studentData.students.find(s => s.id === args.studentId);
            if (!student) {
              throw new McpError(ErrorCode.InvalidParams, 'Student not found');
            }

            const locations = student.data.map?.locations || [];
            const location = locations.find(loc => 
              loc.name === args.name && loc.type === args.type
            );

            if (!location) {
              throw new McpError(ErrorCode.InvalidParams, 'Location not found');
            }

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(location)
              }]
            };
          } catch (error) {
            console.error('Error getting map location details:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to get map location details');
          }
        }

        case 'update_map_location': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.locationId || !args?.updates) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID, location ID, and updates are required');
          }

          try {
            const studentData = await this.readStudents();
            const studentIndex = studentData.students.findIndex(s => s.id === args.studentId);
            if (studentIndex === -1) {
              throw new McpError(ErrorCode.InvalidParams, 'Student not found');
            }

            // Initialize map data if it doesn't exist
            if (!studentData.students[studentIndex].data.map) {
              studentData.students[studentIndex].data.map = { locations: [] };
            }

            const locations = studentData.students[studentIndex].data.map!.locations;
            const locationIndex = locations.findIndex(loc => loc.id === args.locationId);
            
            if (locationIndex === -1) {
              throw new McpError(ErrorCode.InvalidParams, 'Location not found');
            }

            // Apply updates to the location
            const updates = args.updates as Partial<MapLocation>;
            const currentLocation = locations[locationIndex];
            
            // Handle sourceChats array updates specially
            if (updates.sourceChats) {
              const existingChats = currentLocation.sourceChats || [];
              const newChats = updates.sourceChats;
              // Merge and deduplicate chat IDs
              const mergedChats = [...new Set([...existingChats, ...newChats])];
              updates.sourceChats = mergedChats;
            }

            // Merge updates with existing location
            locations[locationIndex] = {
              ...currentLocation,
              ...updates,
              // Ensure metadata is properly merged
              metadata: {
                ...currentLocation.metadata,
                ...(updates.metadata || {})
              }
            };

            await this.writeStudents(studentData);
            return {
              content: [{ type: 'text', text: 'Location updated successfully' }],
            };
          } catch (error) {
            console.error('Error updating map location:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to update map location');
          }
        }

        case 'create_calendar_item': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.item) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID and item are required');
          }

          try {
            // Make API call to backend to create calendar item
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
            const item = args.item as { title: string; date: string; description?: string; category?: string };
            const response = await axios.post(`${backendUrl}/api/calendar`, {
              studentId: args.studentId,
              ...item
            });
            
            if (response.status === 200 || response.status === 201) {
              return {
                content: [{ type: 'text', text: `Calendar item "${item.title}" created successfully` }],
              };
            } else {
              throw new Error(`Backend returned status ${response.status}`);
            }
          } catch (error) {
            console.error('Error creating calendar item:', error);
            // Return a more informative error message
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
              content: [{ type: 'text', text: `Failed to create calendar item: ${errorMsg}` }],
            };
          }
        }

        case 'create_task': {
          const args = request.params.arguments;
          if (!args?.studentId || !args?.task) {
            throw new McpError(ErrorCode.InvalidParams, 'Student ID and task are required');
          }

          try {
            // Make API call to backend to create task
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
            const task = args.task as { title: string; description?: string; dueDate: string; priority: string; category: string };
            const response = await axios.post(`${backendUrl}/api/tasks`, {
              studentId: args.studentId,
              ...task
            });
            
            if (response.status === 200 || response.status === 201) {
              return {
                content: [{ type: 'text', text: `Task "${task.title}" created successfully` }],
              };
            } else {
              throw new Error(`Backend returned status ${response.status}`);
            }
          } catch (error) {
            console.error('Error creating task:', error);
            // Return a more informative error message
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
              content: [{ type: 'text', text: `Failed to create task: ${errorMsg}` }],
            };
          }
        }

        case 'update_plan': {
          const args = request.params.arguments;
          if (!args?.planId || !args?.timelineItems) {
            throw new McpError(ErrorCode.InvalidParams, 'Plan ID and timeline items are required');
          }

          try {
            // For now, just return success - plans would be handled by the backend
            console.log('Plan update requested:', args);
            return {
              content: [{ type: 'text', text: 'Plan updated successfully' }],
            };
          } catch (error) {
            console.error('Error updating plan:', error);
            throw new McpError(ErrorCode.InternalError, 'Failed to update plan');
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
