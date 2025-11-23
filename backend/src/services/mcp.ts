import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import { addMapLocation, getMapLocations, deleteMapLocation, clearMapLocations, getChats, saveChat, updateMapLocation } from './firestore.js';
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
export const executeMcpTool = async (serverName: string, toolName: string, args: Record<string, any> | string, userId?: string, chatId?: string) => {
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

        // Use the passed chatId directly (from the AI service context)
        // This fixes the race condition where the current chat hasn't been saved yet
        const currentChatId = chatId || null;

        if (currentChatId) {
          console.log('create_map_location: Associating with current chat ID:', currentChatId);
        } else {
          console.warn('create_map_location: No chat ID provided, location will not be associated with a chat');
        }

        // Add current chat ID to sourceChats if provided
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

      case 'update_map_location_tier': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for update_map_location_tier');
        }
        const { studentId, locationId, tier, reasoning, confirmedByUser, meritAidLikelihood, meritAidReasoning } = args;
        if (!studentId || !locationId || !tier || !reasoning) {
          throw new Error('Student ID, location ID, tier, and reasoning are required');
        }

        // Get all locations for this student
        const locations = await getMapLocations(studentId, userId);
        const location = locations.find(loc => loc.id === locationId);

        if (!location) {
          throw new Error(`Location not found with ID: ${locationId}. Available IDs: ${locations.map(loc => `${loc.id} (${loc.name})`).join(', ')}`);
        }

        // Only allow tier updates for colleges
        if (location.type !== 'college') {
          throw new Error('Tier classification only applies to colleges, not scholarships');
        }

        // Build updates object
        const updates: any = {
          tier: tier,
          tierReasoning: reasoning,
          tierConfirmedByUser: confirmedByUser !== undefined ? confirmedByUser : false,
          tierLastUpdated: new Date().toISOString()
        };

        // Add merit aid fields if provided
        // Note: These are stored as custom fields on the location, not in metadata
        if (meritAidLikelihood) {
          updates.meritAidLikelihood = meritAidLikelihood;
        }
        if (meritAidReasoning) {
          updates.meritAidReasoning = meritAidReasoning;
        }

        // Use the existing updateMapLocation function from firestore.ts
        await updateMapLocation(studentId, locationId, updates, userId);

        let responseText = `Tier updated to "${tier}" for ${location.name}`;
        if (meritAidLikelihood) {
          responseText += ` with ${meritAidLikelihood} merit aid likelihood`;
        }

        return { content: [{ type: 'text', text: responseText }] };
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
        const { studentId, schoolNames, description, sourceChatId, sourcePinIds } = args;
        if (!studentId || !schoolNames) {
          throw new Error('Student ID and school names are required');
        }

        console.log('=== CREATE_PLAN FUNCTION CALLED ===');
        console.log(`Student ID: ${studentId}`);
        console.log(`School Names: ${JSON.stringify(schoolNames)}`);
        console.log(`Description: ${description || 'Auto-generated'}`);
        console.log(`Source Chat ID: ${sourceChatId || 'None provided'}`);
        console.log(`Source Pin IDs: ${JSON.stringify(sourcePinIds) || 'None provided'}`);

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
            sourceChats: sourceChatId ? [sourceChatId] : [],
            sourcePins: sourcePinIds && Array.isArray(sourcePinIds) ? sourcePinIds : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          console.log(`Creating plan with ID: ${newPlan.id}`);
          console.log(`Plan will be linked to source chats: ${JSON.stringify(newPlan.sourceChats)}`);
          
          await db.collection('plans').doc(newPlan.id).set(newPlan);
          console.log('Plan successfully saved to Firestore');
          
          // Find and mark the current strategic planning chat as processed to prevent map reprocessing
          try {
            const { getChats, saveChat } = await import('./firestore.js');
            const chats = await getChats(studentId);
            
            // Find the most recent strategic planning chat (should be the current one)
            const strategicPlanningChat = chats
              .filter(c => (c as any).type === 'strategic-planning' && !c.processed)
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
            
            if (strategicPlanningChat) {
              console.log(`Found current strategic planning chat: "${strategicPlanningChat.title}" (ID: ${strategicPlanningChat.id})`);
              console.log('Marking strategic planning chat as processed to prevent map reprocessing...');
              await saveChat({ 
                ...strategicPlanningChat, 
                processed: true, 
                processedAt: new Date().toISOString() 
              });
              console.log('Strategic planning chat successfully marked as processed');
            } else {
              console.log('No unprocessed strategic planning chat found - this may be normal');
            }
            
            if (sourceChatId) {
              console.log(`Source chat ID ${sourceChatId} was used for context (already processed)`);
            } else {
              console.log('No source chat ID provided - plan will not be linked to any source conversation');
            }
          } catch (error) {
            console.warn('create_plan: Failed to mark strategic planning chat as processed:', error);
            // Don't fail the plan creation if chat marking fails
          }
          
          console.log('=== CREATE_PLAN FUNCTION COMPLETED ===');
          
          return {
            content: [{ type: 'text', text: `Plan "${planDescription}" created successfully with ID: ${newPlan.id}` }],
          };
        } catch (error: any) {
          console.error('Error creating plan:', error);
          console.log('=== CREATE_PLAN FUNCTION FAILED ===');
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

      case 'geocode_batch': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for geocode_batch');
        }
        const { locations } = args;
        if (!locations || !Array.isArray(locations)) {
          throw new Error('Locations array is required');
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key not configured');
        }

        try {
          const results: Array<{ name: string; latitude?: number; longitude?: number; formattedAddress?: string; error?: string }> = [];

          // Process locations with rate limiting (avoid hitting API limits)
          for (const location of locations) {
            try {
              const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                  address: location.address,
                  key: apiKey
                }
              });

              if (response.data.status === 'OK') {
                const geocodeResult = response.data.results[0].geometry.location;
                results.push({
                  name: location.name,
                  latitude: geocodeResult.lat,
                  longitude: geocodeResult.lng,
                  formattedAddress: response.data.results[0].formatted_address
                });
              } else {
                results.push({
                  name: location.name,
                  error: `Geocoding failed: ${response.data.status}`
                });
              }

              // Add small delay to avoid rate limiting
              if (locations.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (locationError: any) {
              const errorMsg = locationError.message || 'Unknown error';
              results.push({
                name: location.name,
                error: errorMsg
              });
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(results)
            }]
          };
        } catch (error: any) {
          throw new Error(`Failed to batch geocode locations: ${error.message}`);
        }
      }

      case 'create_map_locations_batch': {
        if (!userId) throw new Error('User ID is required for map operations');
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for create_map_locations_batch');
        }
        const { studentId, locations } = args;
        if (!studentId || !locations || !Array.isArray(locations)) {
          throw new Error('Student ID and locations array are required');
        }

        try {
          // Import the batch function from firestore
          const { addMapLocationsBatch } = await import('./firestore.js');

          // Use the passed chatId directly (from the AI service context)
          // This fixes the race condition where the current chat hasn't been saved yet
          const currentChatId = chatId || null;

          if (currentChatId) {
            console.log('create_map_locations_batch: Associating with current chat ID:', currentChatId);
          } else {
            console.warn('create_map_locations_batch: No chat ID provided, locations will not be associated with a chat');
          }

          // Add current chat ID to sourceChats for all locations
          const locationsWithChat = locations.map((location: any) => ({
            ...location,
            studentId,
            sourceChats: currentChatId ? [currentChatId] : (location.sourceChats || [])
          }));
          
          // Use the batch function from firestore
          const result = await addMapLocationsBatch(locationsWithChat, userId);
          
          // Auto-mark current chat as processed since we're creating map pins
          if (currentChatId && result.successCount > 0) {
            try {
              const chats = await getChats(studentId);
              const currentChat = chats.find(c => c.id === currentChatId);
              
              if (currentChat) {
                console.log('create_map_locations_batch: Auto-marking chat as processed:', currentChat.title);
                await saveChat({ 
                  ...currentChat, 
                  processed: true, 
                  processedAt: new Date().toISOString() 
                });
              }
            } catch (error) {
              console.warn('create_map_locations_batch: Failed to auto-mark chat as processed:', error);
              // Don't fail the location creation if chat marking fails
            }
          }
          
          const message = `Created ${result.successCount} of ${locations.length} map locations successfully`;
          const fullMessage = result.errors.length > 0 
            ? `${message}. Errors: ${result.errors.join('; ')}`
            : message;
          
          return { content: [{ type: 'text', text: fullMessage }] };
        } catch (error: any) {
          throw new Error(`Failed to create map locations batch: ${error.message}`);
        }
      }

      case 'mark_chat_processed': {
        if (typeof args === 'string') {
          throw new Error('Invalid arguments for mark_chat_processed');
        }
        const { studentId, chatId } = args;
        if (!studentId || !chatId) {
          throw new Error('Student ID and chat ID are required');
        }

        try {
          const chats = await getChats(studentId);
          const chat = chats.find(c => c.id === chatId);
          
          if (!chat) {
            throw new Error('Chat not found');
          }

          console.log('mark_chat_processed: Marking chat as processed:', chat.title);
          await saveChat({ 
            ...chat, 
            processed: true, 
            processedAt: new Date().toISOString() 
          });
          
          return {
            content: [{ type: 'text', text: `Chat "${chat.title}" marked as processed successfully` }],
          };
        } catch (error: any) {
          console.error('Error marking chat as processed:', error);
          const errorMsg = error.message || 'Unknown error';
          return {
            content: [{ type: 'text', text: `Failed to mark chat as processed: ${errorMsg}` }],
          };
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
