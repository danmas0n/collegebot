import { recommendationsInstructions } from './recommendations_instructions.js';
import { mapInstructions } from './map_instructions.js';
import { getMapLocations } from '../services/firestore.js';
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
    name: 'fetch_markdown',
    description: 'Fetch and extract markdown content from a webpage URL',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch content from',
        required: true
      }
    ]
  }
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

  instructions += `Tool Usage and Response Format Requirements:

1. Thinking, Tool and Answer Tags:
   - You are going to take turns with the user. They go first.  
   - After the user speaks, you will think and use tools until you have an answer to their question.
   - Thinking:
     - Use <thinking></thinking> tags to share your concise reasoning process
     - Keep thinking tags brief and focused on your current analysis, not recapping previous information
     - Use your creativity and world knowledge to generate insightful ideas for the student
     - Only use tools to verify specific facts, figures, and details that may have changed since your training
   - Tool Calls:
     - Format tool calls like this:
       <tool>
         <name>search_college_data</name>
         <parameters>
           {"query": "Stanford University"}
         </parameters>
       </tool>
     - When you make a tool call, the system will automatically execute it and return the results to you
     - You only need to provide one complete tool call - the system will detect it and execute it
     - Make sure your tool calls have well-formed XML and JSON
   - Answers:
     - When you're ready, respond to the user's question with <answer></answer> tags
     - Format your answer in HTML, not Markdown (use <ul>, <li>, <p>, <strong>, <em>, etc.)
     - This can be either a summary of your findings or a question to the user on how to proceed
   - Once you have answered, the user will respond or ask a new question, and you can continue the conversation

   Important Notes:
   - Balance your world knowledge with tool use - you know general facts about colleges, but verify specifics (costs, deadlines, etc.)
   - When using get_cds_data, always use the full, formal name of the college with proper punctuation 
     (e.g., "University of Massachusetts - Amherst" not "UMass Amherst").
   - Don't worry about calculating distances -- we'll do that when we add things to the map. Just consider
     regional or state preferences.
   - Be creative with suggestions - students want insightful recommendations they couldn't easily find elsewhere
   - If a tool call fails, try again with a different approach or ask the user for more information
   - If you don't have enough information to do your job, ask the user for more details or suggest a different approach

`;

  return instructions;
};

export const getBasePrompt = async (studentName: string, studentData: any, mode = 'recommendations', req?: Request): Promise<string> => {
  const baseInstructions = `You are an AI college advisor helping a student named ${studentName}. 
You have access to their profile data and can use tools to fetch college information from the Internet as needed.`;

  let modeSpecificInstructions: string;
  let tools: Tool[];

  switch (mode) {
    case 'recommendations':
      modeSpecificInstructions = `Your goal is to generate great recommendations for colleges and scholarships that match ${studentName}'s profile and interests.

${recommendationsInstructions}`;
      tools = RECOMMENDATION_TOOLS;
      break;

    case 'map_enrichment':
      modeSpecificInstructions = `Your goal is to analyze our conversation and extract any college or scholarship locations we discussed,
adding them to the student's map to help them visualize their options geographically.

${mapInstructions}`;
      tools = MAP_TOOLS;
      break;

    default:
      modeSpecificInstructions = `Your goal is to generate great recommendations for colleges and scholarships that match ${studentName}'s profile and interests.

${recommendationsInstructions}`;
      tools = RECOMMENDATION_TOOLS;
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
  } catch (error) {
    console.error('Error getting additional context:', error);
    // Continue without the additional context rather than failing
    additionalContext = '\nFailed to load current state';
  }

  return `${baseInstructions}
${modeSpecificInstructions}

Student Profile:
${JSON.stringify(contextData, null, 2)}

${generateToolInstructions(mode)}
${additionalContext}

Format your responses clearly:
- Use HTML formatting for structure and emphasis
- Include relevant statistics
- Highlight key information
- Organize information logically
- Make complex topics understandable

After providing your answer, suggest a brief, descriptive title for this chat based on the discussion. Format it as: <title>Your suggested title</title>
`;
};
