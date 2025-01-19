import { graphInstructions } from './graph_instructions.js';
import { recommendationsInstructions } from './recommendations_instructions.js';
import { executeMcpTool } from '../utils/mcp.js';

// Tools for making college recommendations
const RECOMMENDATION_TOOLS = [
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

// Tools for managing the knowledge graph
const GRAPH_TOOLS = [
  {
    name: 'create_entities',
    description: 'Create multiple new entities in the knowledge graph',
    parameters: [
      {
        name: 'entities',
        type: 'array',
        description: 'Array of entities to create, each with name, entityType, and observations array',
        required: true
      }
    ]
  },
  {
    name: 'create_relations',
    description: 'Create multiple new relations between entities in the knowledge graph',
    parameters: [
      {
        name: 'relations',
        type: 'array',
        description: 'Array of relations to create, each with from, to, and relationType',
        required: true
      }
    ]
  },
  {
    name: 'add_observations',
    description: 'Add new observations to existing entities',
    parameters: [
      {
        name: 'observations',
        type: 'array',
        description: 'Array of objects with entityName and contents (array of observations)',
        required: true
      }
    ]
  },
  {
    name: 'delete_entities',
    description: 'Remove entities and their relations from the knowledge graph',
    parameters: [
      {
        name: 'entityNames',
        type: 'array',
        description: 'Array of entity names to delete',
        required: true
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
  },
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
        required: false      }
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
  }
];

export const generateToolInstructions = (mode) => {
  let instructions = 'Available tools:\n\n';
  
  const tools = mode === 'recommendations' ? RECOMMENDATION_TOOLS : GRAPH_TOOLS;
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

1. Tool Calls Always End Messages:
   - Format tool calls like this:
     <tool>
      <name>search_college_data</name>
      <parameters>{"query": "Stanford University"}</parameters>
     </tool>
   - CRITICAL: YOU MUST RETURN WELL FORMED XML.  If you don't close your tags, the system will break.
   - CRITICAL: MAKE ONE TOOL CALL AT A TIME.  END YOUR MESSAGE IMMEDIATELY after the tool call. 
     Do not include additional text in the same message.  The tool call result will be passed to you on your next turn.

2. Thinking and Response Structure:
   - Use <thinking> tags to show your analysis and reasoning process
   - When thinking, be concise; don't talk to the user, just think out loud to yourself
   - When you have a response or question for the user, use <answer> tags.
   - You MUST end every full thought process and response (which can span multiple messages and tool calls) with 
     an answer to the user, wrapped in <answer> and </answer> tags.  
     CRITICAL: Please ensure that you close your </answer> tag!  
   - Once you have sent your answer, the user will respond or ask a new question, and you can continue the conversation.
   
   Example message flow:

   User message 1:
   [user message or question about colleges]

   Assistant message 1:
   <thinking>
   First, I'll search for colleges matching the student's interests...
   </thinking>
   <tool>
     <name>search_college_data</name>
     <parameters>{"query": "great engineering colleges"}</parameters>
   </tool>

   Tool message 1:
   [Tool call returns a response]

   Assistant message 2:
   <thinking>
   Based on these results, I see several promising matches. I'll fetch more details about the top candidate...
   </thinking>
   <tool>
    ...
   </tool>

   Tool message 2:
   [Tool call returns a response]

   Assistant message 3:
   <thinking>
   After analyzing the data, I think I should recommend...
   </thinking>
   <answer>
   These three programs are good fits for you...
   </answer>

   User message 2:
   Thanks, that's super helpful!  Let's dig deeper on the first one...

   etc.

   CRITICAL REQUIREMENTS:
   - NEVER make multiple tool calls at once. ONE AT A TIME.
   - ALWAYS analyze tool responses before proceeding
   - DO NOT RELY ON YOUR WORLD KNOWLEDGE to make recommendations.  Using your world knowledge to generate research ideas is fine.
   - VERIFY important claims with data from tools before making recommendations
   - EXPLAIN your analysis of each piece of data
   - BUILD your response step by step with confirmed information`;

  return instructions;
};

export const generateBasePrompt = async (studentName, studentData, mode = 'recommendations') => {
  const baseInstructions = `You are an AI college advisor helping a student named ${studentName}. 
You have access to their profile data and can use tools to fetch college information from the Internet as needed.`;

  const modeSpecificInstructions = mode === 'recommendations' ? 
    `Your goal is to generate great recommendations for colleges and scholarships that match ${studentName}'s profile and interests.

${recommendationsInstructions}` :
    `Your goal is to analyze our conversation and extract any college or scholarship recommendations we discussed,
adding them to the student's knowledge graph to help them track their options.

${graphInstructions}`;

  return `${baseInstructions}
${modeSpecificInstructions}

Student Profile:
${JSON.stringify({
  name: studentName,
  ...studentData.studentProfile,
  interests: {
    majors: studentData.collegeInterests?.majors || [],
    fieldsOfStudy: studentData.collegeInterests?.fieldsOfStudy || []
  },
  budget: {
    yearly: studentData.budgetInfo?.yearlyBudget,
    willingness: studentData.budgetInfo?.willingness || {}
  }
}, null, 2)}

${generateToolInstructions(mode)}

${mode === 'graph_enrichment' ? 
  // Get current graph state for context
  `Current Knowledge Graph State:
${JSON.stringify(await executeMcpTool('memory', 'read_graph', {}), null, 2)}` : 
  ''}

Format your responses clearly:
- Use bullet points for lists
- Include relevant statistics
- Highlight key information
- Organize information logically
- Make complex topics understandable

`;
};
