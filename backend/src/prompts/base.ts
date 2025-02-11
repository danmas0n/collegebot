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
        description: 'Name of the college',
        required: true
      },
      {
        name: 'year',
        type: 'string',
        description: 'Academic year (e.g., "2022-2023")',
        required: false
      }
    ]
  },
  {
    name: 'fetch',
    description: 'Fetch and extract content from a webpage URL',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'URL to fetch content from',
        required: true
      },
      {
        name: 'max_length',
        type: 'integer',
        description: 'Maximum number of characters to return (default: 5000)',
        required: false
      },
      {
        name: 'start_index',
        type: 'integer',
        description: 'Start content from this character index (default: 0)',
        required: false
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
   - You are going to take turns with the user.  They go first.  
   - After the user speaks, you will think and use tools until you have an answer to their question.
   - CRITICAL: Start slow -- think a tiny bit, call a tool and end your message and wait for the result.
     Don't try to do everything at once.
   - Thinking:
     - Use <thinking></thinking> tags to show your analysis and reasoning process
     - When thinking, be concise; don't talk to the user, just think out loud to yourself
     - After thinking, you must either call a tool to get more data, or answer the question, and then end
       the message.  No exceptions.
     - It's OK to pause your thinking while you wait for the results of a tool call.
   - Tool Calls:
    - Format tool calls like this:
      <tool>
        <name>search_college_data</name>
        <parameters>
          {"query": "Stanford University"}
        </parameters>
      </tool>
    - To call a tool, respond with a correctly formatted <tool> tag, and then end your message.  
      The tool call results will be passed back to you so you can keep thinking.
      - CRITICAL: ONLY CALL ONE TOOL AT A TIME!  Don't worry, you'll get called back to continue your thought process.
      - CRITICAL: YOU MUST RETURN WELL FORMED XML AND/OR JSON in your tool calls.  Ensure you close each tag.  
        If you don't, the system will break.
      - CRITICAL: END YOUR MESSAGE IMMEDIATELY AFTER THE </tool> TAG.  
        This signals the system to call the tool and return the results to you.
   - Answers:
     - When you're ready, you can stop thinking and respond to the user's question.
     - Use <answer></answer> tags to do this.  
     - This can be either a summary of your findings or a question to the user on how to proceed.
     - You can provide an <answer> right after a <thinking> tag if you are done thinking and have an answer.
   - You MUST end every full thought process (which can span multiple messages and tool calls) with 
     an <answer> to the user, wrapped in well formed <answer> and </answer> tags.  
   - Once you have answered, the user will respond or ask a new question, and you can continue the conversation.

   Important Notes:
   - You don't know the latest college costs, reviews, etc.  Use the tools to get actual data.  
   - Don't worry about calculating distances -- we'll do that when we add things to the map.  Just consider
     regional or state preferences.
   - EXPLAIN your analysis of each piece of data
   - BUILD your response step by step with confirmed information
   - If a tool call fails, try again one or two more times.  If tool calls continue to fail, explain that to the 
     user and gracefully stop.
   - If you don't have enough information to do your job, ask the user for more details or suggest a different approach.

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
- Use bullet points for lists
- Include relevant statistics
- Highlight key information
- Organize information logically
- Make complex topics understandable

After providing your answer, suggest a brief, descriptive title for this chat based on the discussion. Format it as: <title>Your suggested title</title>
`;
};
