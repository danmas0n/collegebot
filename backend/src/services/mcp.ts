import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { addMapLocation, getMapLocations, deleteMapLocation, clearMapLocations } from './firestore.js';
import { settingsService } from './settings.js';

// Helper function to create MCP client
export const createMcpClient = async (serverName: string) => {
  // Base environment with PATH
  let env: Record<string, string> = { PATH: process.env.PATH || '' };
  let command: string, args: string[];
  
  switch (serverName) {
    case 'college-data': {
      command = 'node';
      args = ['../mcp/college-data-server/build/index.js'];
      const geminiConfig = await settingsService.getGeminiConfig();
      env = {
        ...env,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
        GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID || '',
        GEMINI_API_KEY: geminiConfig.apiKey,
        GEMINI_MODEL: geminiConfig.model
      };
      break;
    }
    case 'fetch':
      command = 'npx';
      args = ['-y', '@tokenizin/mcp-npx-fetch'];
      break;
    case 'student-data':
      // This is now handled directly through Firestore
      return null;
    default:
      throw new Error(`Unknown MCP server: ${serverName}`);
  }

  const transport = new StdioClientTransport({
    command,
    args,
    env
  });

  const client = new Client({
    name: "collegebot-backend",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
};

// Helper function to execute MCP tool
export const executeMcpTool = async (serverName: string, toolName: string, args: Record<string, any> | string, userId?: string) => {
  // Handle student-data tools directly
  if (serverName === 'student-data') {
    switch (toolName) {
      case 'geocode': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for geocode');
        }
        const { address, name } = args;
        if (!address || !name) {
          throw new Error('Address and name are required');
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key not configured');
        }

        try {
          const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
              address,
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
                name,
                latitude: location.lat,
                longitude: location.lng,
                formattedAddress: response.data.results[0].formatted_address
              })
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to geocode address: ${error.message}`);
        }
      }

      case 'create_map_location': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_map_location');
        }
        const { studentId, location } = args;
        if (!studentId || !location) {
          throw new Error('Student ID and location are required');
        }
        await addMapLocation({ ...location, studentId }, userId);
        return { content: [{ type: 'text', text: 'Location added successfully' }] };
      }

      case 'get_map_locations': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for get_map_locations');
        }
        const { studentId } = args;
        if (!studentId) {
          throw new Error('Student ID is required');
        }
        const locations = await getMapLocations(studentId, userId);
        return { content: [{ type: 'text', text: JSON.stringify(locations) }] };
      }

      case 'clear_map_locations': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for clear_map_locations');
        }
        const { studentId } = args;
        if (!studentId) {
          throw new Error('Student ID is required');
        }
        await clearMapLocations(studentId, userId);
        return { content: [{ type: 'text', text: 'Map locations cleared successfully' }] };
      }

      case 'list_map_location_names': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for list_map_location_names');
        }
        const { studentId } = args;
        if (!studentId) {
          throw new Error('Student ID is required');
        }
        const locations = await getMapLocations(studentId, userId);
        const locationNames = locations.map(loc => ({
          name: loc.name,
          type: loc.type,
          id: loc.id
        }));
        return { content: [{ type: 'text', text: JSON.stringify(locationNames) }] };
      }

      case 'get_map_location_details': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for get_map_location_details');
        }
        const { studentId, name, type } = args;
        if (!studentId || !name || !type) {
          throw new Error('Student ID, name, and type are required');
        }
        const locations = await getMapLocations(studentId, userId);
        const location = locations.find(loc => loc.name === name && loc.type === type);
        if (!location) {
          throw new Error('Location not found');
        }
        return { content: [{ type: 'text', text: JSON.stringify(location) }] };
      }

      case 'update_map_location': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for update_map_location');
        }
        const { studentId, locationId, updates } = args;
        if (!studentId || !locationId || !updates) {
          throw new Error('Student ID, location ID, and updates are required');
        }
        
        console.log('update_map_location: Looking for locationId:', locationId);
        const locations = await getMapLocations(studentId, userId);
        console.log('update_map_location: Available locations:', locations.map(loc => ({ id: loc.id, name: loc.name })));
        
        const location = locations.find(loc => loc.id === locationId);
        if (!location) {
          console.log('update_map_location: Location not found. Available IDs:', locations.map(loc => loc.id));
          throw new Error(`Location not found. Available IDs: ${locations.map(loc => loc.id).join(', ')}`);
        }
        
        console.log('update_map_location: Found location:', location.name);
        
        const updatedLocation = {
          ...location,
          ...updates,
          sourceChats: updates.sourceChats ? 
            [...new Set([...(location.sourceChats || []), ...updates.sourceChats])] :
            location.sourceChats,
          metadata: {
            ...location.metadata,
            ...(updates.metadata || {})
          }
        };
        
        console.log('update_map_location: Updating location with sourceChats:', updatedLocation.sourceChats);
        
        await deleteMapLocation(studentId, locationId, userId);
        await addMapLocation(updatedLocation, userId);
        
        return { content: [{ type: 'text', text: 'Location updated successfully' }] };
      }

      default:
        throw new Error(`Unknown student-data tool: ${toolName}`);
    }
  }

  // Handle other MCP servers
  let client;
  try {
    console.log('Backend - Creating MCP client for:', serverName);
    client = await createMcpClient(serverName);
    if (!client) {
      throw new Error(`Failed to create client for server: ${serverName}`);
    }
    console.log('Backend - MCP client created and connected');

    const request = {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: typeof args === 'string' ? JSON.parse(args) : args
      }
    };
    console.log('Backend - Sending MCP request:', request);

    const result = await client.request(request, CallToolResultSchema);
    console.log('Backend - Raw MCP response type:', typeof result);
    console.log('Backend - Raw MCP response keys:', result ? Object.keys(result) : 'null');
    const rawResponse = JSON.stringify(result, null, 2);
    console.log('Backend - Raw MCP response:', rawResponse.slice(0, 2000) + (rawResponse.length > 2000 ? '...' : ''));

    if (!result) {
      throw new Error('MCP server returned null response');
    }

    return result;
  } catch (error: any) {
    // Extract the meaningful error message from MCP error chain
    let errorMessage = error.message;
    if (errorMessage.includes('MCP error -32603:')) {
      errorMessage = errorMessage.split('MCP error -32603:').pop()?.trim() || error.message;
    }
    console.error('Backend - MCP error:', errorMessage);
    throw new Error(errorMessage);
  } finally {
    if (client) {
      console.log('Backend - Closing MCP client');
      await client.close();
      console.log('Backend - MCP client closed');
    }
  }
};
