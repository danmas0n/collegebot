import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { addMapLocation, getMapLocations, deleteMapLocation, clearMapLocations, getChats, saveChat } from './firestore.js';
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
        
        // Auto-find current chat and add to sourceChats
        let currentChatId = null;
        try {
          const chats = await getChats(studentId);
          const currentChat = chats
            .filter(c => !c.processed)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          
          if (currentChat) {
            currentChatId = currentChat.id;
            console.log('create_map_location: Auto-associating with current chat:', currentChat.title, 'ID:', currentChatId);
          }
        } catch (error) {
          console.warn('create_map_location: Failed to find current chat:', error);
        }
        
        // Add current chat ID to sourceChats if found
        const locationWithChat = {
          ...location,
          studentId,
          sourceChats: currentChatId ? [currentChatId] : (location.sourceChats || [])
        };
        
        await addMapLocation(locationWithChat, userId);
        
        // Auto-mark current chat as processed since we're creating map pins
        if (currentChatId) {
          try {
            const chats = await getChats(studentId);
            const currentChat = chats.find(c => c.id === currentChatId);
            
            if (currentChat) {
              console.log('create_map_location: Auto-marking chat as processed:', currentChat.title);
              await saveChat({ 
                ...currentChat, 
                processed: true, 
                processedAt: new Date().toISOString() 
              });
            }
          } catch (error) {
            console.warn('create_map_location: Failed to auto-mark chat as processed:', error);
            // Don't fail the location creation if chat marking fails
          }
        }
        
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
        
        // Auto-find current chat and add to sourceChats
        let currentChatId = null;
        try {
          const chats = await getChats(studentId);
          const currentChat = chats
            .filter(c => !c.processed)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          
          if (currentChat) {
            currentChatId = currentChat.id;
            console.log('update_map_location: Auto-associating with current chat:', currentChat.title, 'ID:', currentChatId);
          }
        } catch (error) {
          console.warn('update_map_location: Failed to find current chat:', error);
        }
        
        // Merge sourceChats: existing + updates + current chat
        const existingSourceChats = location.sourceChats || [];
        const updatesSourceChats = updates.sourceChats || [];
        const allSourceChats = [...existingSourceChats, ...updatesSourceChats];
        if (currentChatId && !allSourceChats.includes(currentChatId)) {
          allSourceChats.push(currentChatId);
        }
        
        const updatedLocation = {
          ...location,
          ...updates,
          sourceChats: [...new Set(allSourceChats)], // Remove duplicates
          metadata: {
            ...location.metadata,
            ...(updates.metadata || {})
          }
        };
        
        console.log('update_map_location: Updating location with sourceChats:', updatedLocation.sourceChats);
        
        await deleteMapLocation(studentId, locationId, userId);
        await addMapLocation(updatedLocation, userId);
        
        // Auto-mark current chat as processed since we're updating map pins
        try {
          const chats = await getChats(studentId);
          const currentChat = chats
            .filter(c => !c.processed)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          
          if (currentChat) {
            console.log('update_map_location: Auto-marking chat as processed:', currentChat.title);
            await saveChat({ 
              ...currentChat, 
              processed: true, 
              processedAt: new Date().toISOString() 
            });
          }
        } catch (error) {
          console.warn('update_map_location: Failed to auto-mark chat as processed:', error);
          // Don't fail the location update if chat marking fails
        }
        
        return { content: [{ type: 'text', text: 'Location updated successfully' }] };
      }

      case 'create_calendar_item': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_calendar_item');
        }
        const { studentId, item } = args;
        if (!studentId || !item) {
          throw new Error('Student ID and item are required');
        }

        try {
          // Use Firestore directly instead of HTTP API to avoid auth issues
          const { db } = await import('../config/firebase.js');
          const { v4: uuidv4 } = await import('uuid');
          
          const newItem = {
            id: uuidv4(),
            studentId: studentId,
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('calendar-items').doc(newItem.id).set(newItem);
          
          return {
            content: [{ type: 'text', text: `Calendar item "${item.title}" created successfully` }],
          };
        } catch (error: any) {
          console.error('Error creating calendar item:', error);
          // Return a more informative error message
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to create calendar item: ${errorMsg}` }],
          };
        }
      }

      case 'create_calendar_items_batch': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_calendar_items_batch');
        }
        const { studentId, items, planId } = args;
        if (!studentId || !items || !Array.isArray(items)) {
          throw new Error('Student ID and items array are required');
        }

        try {
          // Use Firestore directly instead of HTTP API to avoid auth issues
          const { db } = await import('../config/firebase.js');
          const { v4: uuidv4 } = await import('uuid');
          
          const batch = db.batch();
          const createdItems = [];
          
          for (const item of items) {
            const newItem = {
              id: uuidv4(),
              studentId: studentId,
              ...item,
              planId: planId || null, // Link to plan if provided
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            const itemRef = db.collection('calendar-items').doc(newItem.id);
            batch.set(itemRef, newItem);
            createdItems.push(newItem);
          }
          
          await batch.commit();
          
          return {
            content: [{ type: 'text', text: `Successfully created ${createdItems.length} calendar items in batch${planId ? ` linked to plan ${planId}` : ''}` }],
          };
        } catch (error: any) {
          console.error('Error creating calendar items batch:', error);
          // Return a more informative error message
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to create calendar items batch: ${errorMsg}` }],
          };
        }
      }

      case 'create_task': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_task');
        }
        const { studentId, task } = args;
        if (!studentId || !task) {
          throw new Error('Student ID and task are required');
        }

        try {
          // Use Firestore directly instead of HTTP API to avoid auth issues
          const { db } = await import('../config/firebase.js');
          const { v4: uuidv4 } = await import('uuid');
          
          const newTask = {
            id: uuidv4(),
            studentId: studentId,
            ...task,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('tasks').doc(newTask.id).set(newTask);
          
          return {
            content: [{ type: 'text', text: `Task "${task.title}" created successfully` }],
          };
        } catch (error: any) {
          console.error('Error creating task:', error);
          // Return a more informative error message
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to create task: ${errorMsg}` }],
          };
        }
      }

      case 'create_tasks_batch': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_tasks_batch');
        }
        const { studentId, tasks, planId } = args;
        if (!studentId || !tasks || !Array.isArray(tasks)) {
          throw new Error('Student ID and tasks array are required');
        }

        try {
          // Use Firestore directly instead of HTTP API to avoid auth issues
          const { db } = await import('../config/firebase.js');
          const { v4: uuidv4 } = await import('uuid');
          
          const batch = db.batch();
          const createdTasks = [];
          
          for (const task of tasks) {
            const newTask = {
              id: uuidv4(),
              studentId: studentId,
              ...task,
              planId: planId || null, // Link to plan if provided
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            const taskRef = db.collection('tasks').doc(newTask.id);
            batch.set(taskRef, newTask);
            createdTasks.push(newTask);
          }
          
          await batch.commit();
          
          return {
            content: [{ type: 'text', text: `Successfully created ${createdTasks.length} tasks in batch${planId ? ` linked to plan ${planId}` : ''}` }],
          };
        } catch (error: any) {
          console.error('Error creating tasks batch:', error);
          // Return a more informative error message
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to create tasks batch: ${errorMsg}` }],
          };
        }
      }

      case 'create_plan': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_plan');
        }
        const { studentId, schoolNames, description, sourceChatId } = args;
        if (!studentId || !schoolNames || !sourceChatId) {
          throw new Error('Student ID, school names, and source chat ID are required');
        }

        try {
          // Use Firestore directly instead of HTTP API to avoid auth issues
          const { db } = await import('../config/firebase.js');
          const { v4: uuidv4 } = await import('uuid');
          
          const schoolNamesArray = Array.isArray(schoolNames) ? schoolNames : [schoolNames];
          const planDescription = description || `Strategic plan for ${schoolNamesArray.join(', ')}`;
          
          const newPlan = {
            id: uuidv4(),
            studentId: studentId,
            schoolName: schoolNamesArray.length === 1 ? schoolNamesArray[0] : 'Multiple Schools',
            schoolId: 'strategic', // Special ID for strategic plans
            description: planDescription,
            status: 'draft',
            timeline: [], // Will be populated later
            sourceChats: [sourceChatId],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('plans').doc(newPlan.id).set(newPlan);
          
          // Auto-mark the strategic planning chat as processed
          try {
            const { getChats, saveChat } = await import('./firestore.js');
            const chats = await getChats(studentId);
            const strategicChat = chats.find(c => c.id === sourceChatId);
            
            if (strategicChat) {
              console.log('create_plan: Auto-marking strategic planning chat as processed:', strategicChat.title);
              await saveChat({ 
                ...strategicChat, 
                processed: true, 
                processedAt: new Date().toISOString() 
              });
            }
          } catch (error) {
            console.warn('create_plan: Failed to auto-mark strategic chat as processed:', error);
            // Don't fail the plan creation if chat marking fails
          }
          
          return {
            content: [{ type: 'text', text: `Plan "${planDescription}" created successfully with ID: ${newPlan.id}` }],
          };
        } catch (error: any) {
          console.error('Error creating plan:', error);
          // Return a more informative error message
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to create plan: ${errorMsg}` }],
          };
        }
      }

      case 'update_plan': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for update_plan');
        }
        const { planId, timelineItems } = args;
        if (!planId || !timelineItems) {
          throw new Error('Plan ID and timeline items are required');
        }

        try {
          // For now, just return success - plans would be handled by the backend
          console.log('Plan update requested:', args);
          return {
            content: [{ type: 'text', text: 'Plan updated successfully' }],
          };
        } catch (error: any) {
          console.error('Error updating plan:', error);
          throw new Error('Failed to update plan');
        }
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
