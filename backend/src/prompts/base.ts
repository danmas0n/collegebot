import { recommendationsInstructions } from './recommendations_instructions.js';
import { mapInstructions } from './map_instructions.js';
import { planInstructions } from './plan_instructions.js';
import { getMapLocations, getChats } from '../services/firestore.js';
import { Request } from 'express';

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

interface StudentLocation {
  regions: string[];
  states: string[];
  minDistanceFromHome?: number;
  maxDistanceFromHome?: number;
  urbanSettings: string[];
}

interface StudentInterests {
  majors: string[];
  fieldsOfStudy: string[];
  locations: StudentLocation;
}

interface StudentBudget {
  yearly?: number;
  willingness: Record<string, any>;
}

interface StudentContextData {
  id: string;
  name: string;
  studentProfile: Record<string, any>;
  interests: StudentInterests;
  budget: StudentBudget;
}

// Tools for making college recommendations
const RECOMMENDATION_TOOLS: Tool[] = [
  {
    name: 'search_college_data',
    description: 'Search for college data sources and information',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query for college data',
        required: true
      },
      {
        name: 'includeWebSearch',
        type: 'boolean',
        description: 'Whether to include web search results',
        required: false
      }
    ]
  },
  {
    name: 'search_cds_data',
    description: 'Search for available Common Data Set files with fuzzy matching - use this to find colleges when you\'re not sure of the exact name',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'College name or partial name to search for (e.g., "Harvard", "MIT", "University of California")',
        required: true
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        required: false
      }
    ]
  },
  {
    name: 'get_cds_data',
    description: 'Get Common Data Set information and full content for a specific college',
    parameters: [
      {
        name: 'collegeName',
        type: 'string',
        description: 'Full, formal name of the college (e.g., "University of Massachusetts - Amherst" not "UMass Amherst")',
        required: true
      },
      {
        name: 'year',
        type: 'string',
        description: 'Academic year (e.g., "2024-2025")',
        required: false
      }
    ]
  },
  {
    name: 'fetch_txt',
    description: 'Fetch and extract clean text content from a webpage URL (strips HTML and JavaScript)',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch content from',
        required: true
      }
    ]
  },
  // Map tools for creating pins during recommendations
  {
    name: 'list_map_location_names',
    description: 'Get a lightweight list of existing map location names and types for a student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      }
    ]
  },
  {
    name: 'get_map_location_details',
    description: 'Get full details for a specific map location by name and type',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'name',
        type: 'string',
        description: 'Location name',
        required: true
      },
      {
        name: 'type',
        type: 'string',
        description: 'Location type (college or scholarship)',
        required: true
      }
    ]
  },
  {
    name: 'geocode',
    description: 'Geocode an address to get latitude and longitude coordinates',
    parameters: [
      {
        name: 'address',
        type: 'string',
        description: 'The address to geocode',
        required: true
      },
      {
        name: 'name',
        type: 'string',
        description: 'Name of the location',
        required: true
      }
    ]
  },
  {
    name: 'create_map_location',
    description: 'Add a location to the student map data',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'location',
        type: 'object',
        description: 'Location object with coordinates and metadata',
        required: true
      }
    ]
  },
  {
    name: 'update_map_location',
    description: 'Update an existing map location with new data',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'locationId',
        type: 'string',
        description: 'Location ID to update',
        required: true
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Partial updates to apply to the location',
        required: true
      }
    ]
  },
  {
    name: 'clear_map_locations',
    description: 'Clear all map locations for a student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      }
    ]
  },
];

// Tools for managing map locations
const MAP_TOOLS: Tool[] = [
  {
    name: 'geocode',
    description: 'Geocode an address to get latitude and longitude coordinates',
    parameters: [
      {
        name: 'address',
        type: 'string',
        description: 'The address to geocode',
        required: true
      },
      {
        name: 'name',
        type: 'string',
        description: 'Name of the location',
        required: true
      }
    ]
  },
  {
    name: 'create_map_location',
    description: 'Add a location to the student map data',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'location',
        type: 'object',
        description: 'Location object with coordinates and metadata',
        required: true
      }
    ]
  },
  {
    name: 'get_map_locations',
    description: 'Get all map locations for a student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      }
    ]
  },
  {
    name: 'list_map_location_names',
    description: 'Get a lightweight list of existing map location names and types for a student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      }
    ]
  },
  {
    name: 'get_map_location_details',
    description: 'Get full details for a specific map location by name and type',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'name',
        type: 'string',
        description: 'Location name',
        required: true
      },
      {
        name: 'type',
        type: 'string',
        description: 'Location type (college or scholarship)',
        required: true
      }
    ]
  },
  {
    name: 'update_map_location',
    description: 'Update an existing map location with new data',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'locationId',
        type: 'string',
        description: 'Location ID to update',
        required: true
      },
      {
        name: 'updates',
        type: 'object',
        description: 'Partial updates to apply to the location',
        required: true
      }
    ]
  },
];

// Tools for strategic plan building
const PLAN_TOOLS: Tool[] = [
  // Strategic research tools (no CDS - focus on current info)
  {
    name: 'search_college_data',
    description: 'Search for college data sources and information',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query for college data',
        required: true
      },
      {
        name: 'includeWebSearch',
        type: 'boolean',
        description: 'Whether to include web search results',
        required: false
      }
    ]
  },
  {
    name: 'fetch_txt',
    description: 'Fetch and extract clean text content from a webpage URL (strips HTML and JavaScript)',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch content from',
        required: true
      }
    ]
  },
  // Plan creation tools
  {
    name: 'create_calendar_item',
    description: 'Create a calendar event for the student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'item',
        type: 'object',
        description: 'Calendar item object with title, date, description, etc.',
        required: true
      }
    ]
  },
  {
    name: 'create_calendar_items_batch',
    description: 'Create multiple calendar events for the student in one operation',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'items',
        type: 'array',
        description: 'Array of calendar item objects with title, date, description, category, priority, etc.',
        required: true
      },
      {
        name: 'planId',
        type: 'string',
        description: 'ID of the plan to link calendar items to',
        required: false
      }
    ]
  },
  {
    name: 'create_task',
    description: 'Create a task for the student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'task',
        type: 'object',
        description: 'Task object with title, description, dueDate, priority, category, etc.',
        required: true
      }
    ]
  },
  {
    name: 'create_tasks_batch',
    description: 'Create multiple tasks for the student in one operation',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'tasks',
        type: 'array',
        description: 'Array of task objects with title, description, dueDate, priority, category, etc.',
        required: true
      },
      {
        name: 'planId',
        type: 'string',
        description: 'ID of the plan to link tasks to',
        required: false
      }
    ]
  },
  {
    name: 'update_plan',
    description: 'Update a plan with new timeline items',
    parameters: [
      {
        name: 'planId',
        type: 'string',
        description: 'ID of the plan to update',
        required: true
      },
      {
        name: 'timelineItems',
        type: 'array',
        description: 'Array of timeline items to add to the plan',
        required: true
      }
    ]
  },
  {
    name: 'create_plan',
    description: 'Create a strategic plan for the student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'schoolNames',
        type: 'array',
        description: 'Array of school names or single school name for the plan',
        required: true
      },
      {
        name: 'description',
        type: 'string',
        description: 'Description of the plan',
        required: false
      },
      {
        name: 'sourceChatId',
        type: 'string',
        description: 'ID of the source chat (if any) to link to the plan',
        required: false
      },
      {
        name: 'sourcePinIds',
        type: 'array',
        description: 'Array of pin/location IDs that this plan is based on',
        required: false
      }
    ]
  },
  {
    name: 'clear_map_locations',
    description: 'Clear all map locations for a student',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      }
    ]
  },
  {
    name: 'mark_chat_processed',
    description: 'Mark a chat as processed to prevent reprocessing',
    parameters: [
      {
        name: 'studentId',
        type: 'string',
        description: 'ID of the student',
        required: true
      },
      {
        name: 'chatId',
        type: 'string',
        description: 'ID of the chat to mark as processed',
        required: true
      }
    ]
  }
];

export const generateToolInstructions = (mode: string): string => {
  let instructions = 'Available tools:\n\n';
  
  let tools: Tool[];
  switch (mode) {
    case 'recommendations':
      tools = RECOMMENDATION_TOOLS;
      break;
    case 'map_enrichment':
      tools = MAP_TOOLS;
      break;
    case 'plan_building':
      tools = PLAN_TOOLS;
      break;
    default:
      tools = RECOMMENDATION_TOOLS;
      break;
  }
  tools.forEach((tool, index) => {
    instructions += `${index + 1}. ${tool.name}\n`;
    instructions += `Description: ${tool.description}\n`;
    instructions += 'Parameters:\n';
    tool.parameters.forEach(param => {
      instructions += `- ${param.name} (${param.type}${param.required ? ', required' : ', optional'}): ${param.description}\n`;
    });
    instructions += '\n';
  });

  instructions += `Response Format:

1. Process Flow:
   • Use <thinking></thinking> for concise reasoning - avoid repeating previous analysis
   • Focus on NEW insights and decisions, not rehashing what you already know
   • Summarize periodically rather than repeating the same information
   • Use <tool></tool> for tool calls with proper XML/JSON format
   • Use <answer></answer> for final responses in HTML format

2. Tool Call Format:
   <tool>
     <name>tool_name</name>
     <parameters>{"param": "value"}</parameters>
   </tool>

3. Guidelines:
   • Balance world knowledge with tool verification
   • Be creative with unique recommendations
   • Focus on student-specific opportunities
   • Include reference links when available
   • Format answers in HTML (not Markdown)

`;

  return instructions;
};

export const getBasePrompt = async (studentName: string, studentData: any, mode = 'recommendations', req?: Request, additionalOptions?: { currentChatId?: string; currentChatTitle?: string; sourcePinIds?: string[] }): Promise<string> => {
  const baseInstructions = `You are an AI college advisor helping ${studentName}. Use tools to fetch current college information as needed.

IMPORTANT AWARENESS: Colleges use sophisticated algorithms to track student digital behavior and optimize pricing. Always focus on net price (what families actually pay) rather than sticker price, and be aware that merit scholarships often go to affluent families rather than those with the greatest need.`;

  let modeSpecificInstructions: string;

  switch (mode) {
    case 'recommendations':
      modeSpecificInstructions = `Goal: Generate personalized college and scholarship recommendations for ${studentName}.

${recommendationsInstructions}

CRITICAL REQUIREMENT: You MUST ALWAYS provide a title after your answer. This is required for every response in recommendations mode. 

After providing your answer, generate a brief, descriptive title for this chat based on the current discussion. The title should reflect what was discussed and can evolve as the conversation progresses. 

REQUIRED FORMAT: <title>Your suggested title</title>

This title is mandatory and must appear at the end of every response.`;
      break;

    case 'map_enrichment':
      modeSpecificInstructions = `Goal: Extract college/scholarship locations from our conversation and add them to ${studentName}'s map.

${mapInstructions}`;
      break;

    case 'plan_building':
      // Log strategic planning context for debugging
      console.log('=== STRATEGIC PLANNING SESSION STARTING ===');
      console.log(`Student: ${studentName} (ID: ${studentData.id})`);
      if (additionalOptions?.currentChatId) {
        console.log(`Source Chat ID: ${additionalOptions.currentChatId}`);
        console.log(`Source Chat Title: ${additionalOptions.currentChatTitle || 'No title'}`);
        console.log('This chat will be used as context for strategic planning and linked to the created plan.');
      } else {
        console.log('WARNING: No source chat ID provided - plan may not be properly linked to source conversation');
      }
      console.log('=== END STRATEGIC PLANNING CONTEXT ===');

      modeSpecificInstructions = `Goal: Create a comprehensive college application plan for ${studentName}.

${planInstructions}`;
      break;

    default:
      modeSpecificInstructions = `Goal: Generate personalized college and scholarship recommendations for ${studentName}.

${recommendationsInstructions}

CRITICAL REQUIREMENT: You MUST ALWAYS provide a title after your answer. This is required for every response in recommendations mode. 

After providing your answer, generate a brief, descriptive title for this chat based on the current discussion. The title should reflect what was discussed and can evolve as the conversation progresses. 

REQUIRED FORMAT: <title>Your suggested title</title>

This title is mandatory and must appear at the end of every response.`;
      break;
  }

  const contextData: StudentContextData = {
    id: studentData.id,
    name: studentName,
    studentProfile: studentData.studentProfile,
    interests: {
      majors: studentData.collegeInterests?.majors || [],
      fieldsOfStudy: studentData.collegeInterests?.fieldsOfStudy || [],
      locations: {
        regions: studentData.collegeInterests?.locationPreferences?.regions || [],
        states: studentData.collegeInterests?.locationPreferences?.states || [],
        minDistanceFromHome: studentData.collegeInterests?.locationPreferences?.minDistanceFromHome,
        maxDistanceFromHome: studentData.collegeInterests?.locationPreferences?.maxDistanceFromHome,
        urbanSettings: studentData.collegeInterests?.locationPreferences?.urbanSettings || []
      }
    },
    budget: {
      yearly: studentData.budgetInfo?.yearlyBudget,
      willingness: studentData.budgetInfo?.willingness || {}
    }
  };

  // Add mode-specific context
  let additionalContext = '';
  try {
    if (mode === 'map_enrichment' && studentData?.id && req?.user?.uid) {
      const mapLocations = await getMapLocations(studentData.id, req.user.uid);
      additionalContext = `\nCurrent Map State:
${JSON.stringify(mapLocations, null, 2)}`;
    }
    
    // Add source chat context for plan building
    if (mode === 'plan_building' && additionalOptions?.currentChatId && studentData?.id) {
      console.log(`Fetching source chat context for plan building: ${additionalOptions.currentChatId}`);
      
      const chats = await getChats(studentData.id);
      const sourceChat = chats.find(chat => chat.id === additionalOptions.currentChatId);
      
      if (sourceChat) {
        // Filter to only include user questions and assistant answers
        const relevantMessages = sourceChat.messages.filter(msg => 
          msg.role === 'user' || msg.role === 'assistant'
        );
        
        if (relevantMessages.length > 0) {
          const sourceChatContext = relevantMessages.map(msg => {
            const role = msg.role === 'user' ? 'Student Question' : 'AI Response';
            return `${role}: ${msg.content}`;
          }).join('\n\n');
          
          additionalContext += `\n\nSource Pin IDs: ${additionalOptions.sourcePinIds || 'None provided'}
Source Chat Context:
Chat ID: ${additionalOptions.currentChatId}
Chat Title: ${additionalOptions.currentChatTitle || 'No title'}

This strategic plan is being created based on the following conversation where college recommendations were discussed:

${sourceChatContext}

Use this context to create a strategic plan that builds upon the colleges and insights discussed in this conversation.`;
          
          console.log(`Added source chat context: ${relevantMessages.length} messages from chat "${additionalOptions.currentChatTitle}"`);
        } else {
          console.log('Source chat found but no relevant messages (user/assistant) to include');
        }
      } else {
        console.log(`Source chat ${additionalOptions.currentChatId} not found in student's chats`);
      }
    }
    
    // Add source pin IDs context for plan building
    if (mode === 'plan_building' && additionalOptions?.sourcePinIds && additionalOptions.sourcePinIds.length > 0) {
      console.log(`Adding source pin IDs to plan building context: ${JSON.stringify(additionalOptions.sourcePinIds)}`);
      
      // Get map locations to resolve pin names
      if (studentData?.id && req?.user?.uid) {
        try {
          const mapLocations = await getMapLocations(studentData.id, req.user.uid);
          const sourcePinDetails = additionalOptions.sourcePinIds.map(pinId => {
            const location = mapLocations.find(loc => loc.id === pinId);
            return location ? {
              id: pinId,
              name: location.name,
              type: location.type,
              metadata: location.metadata
            } : {
              id: pinId,
              name: `Unknown Location (${pinId})`,
              type: 'unknown',
              metadata: {}
            };
          });
          
          additionalContext += `\n\nSource Pin Context:
Pin IDs: ${JSON.stringify(additionalOptions.sourcePinIds)}

These colleges/locations were selected for strategic planning:

${sourcePinDetails.map(pin => `- ${pin.name} (ID: ${pin.id}, Type: ${pin.type})`).join('\n')}

IMPORTANT: When creating plans, you MUST include these source pin IDs in the sourcePinIds parameter of the create_plan tool so that the plan can be properly linked to these specific colleges/locations.`;
          
          console.log(`Added source pin context: ${sourcePinDetails.length} pins resolved`);
        } catch (error) {
          console.error('Error resolving source pin details:', error);
          additionalContext += `\n\nSource Pin Context:
Pin IDs: ${JSON.stringify(additionalOptions.sourcePinIds)}

IMPORTANT: When creating plans, you MUST include these source pin IDs in the sourcePinIds parameter of the create_plan tool.`;
        }
      } else {
        additionalContext += `\n\nSource Pin Context:
Pin IDs: ${JSON.stringify(additionalOptions.sourcePinIds)}

IMPORTANT: When creating plans, you MUST include these source pin IDs in the sourcePinIds parameter of the create_plan tool.`;
      }
    }
  } catch (error) {
    console.error('Error getting additional context:', error);
    additionalContext = '\nFailed to load current state';
  }

  return `${baseInstructions}

${modeSpecificInstructions}

Student Profile:
${JSON.stringify(contextData, null, 2)}

${generateToolInstructions(mode)}${additionalContext}

Format responses with HTML structure, relevant statistics, and clear organization.
`;
};
