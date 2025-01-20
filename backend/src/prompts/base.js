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

1. Tool Call Rules:
   - Format tool calls like this:
     <tool>
      <name>search_college_data</name>
      <parameters>{"query": "Stanford University"}</parameters>
     </tool>
   - You may call multiple tools in one message if you want to.
   - To call a tool, respond with a correctly formatted <tool> tag, and then end your message.  
     The tool call results will be passed to you on your next turn.
   - CRITICAL: YOU MUST RETURN WELL FORMED XML AND JSON in your tool calls.  If you don't, the system will break.
   - CRITICAL: END YOUR MESSAGE IMMEDIATELY after the tool calls.  Don't keep thinking or answering until you get the tool results.
   - CRITICAL: DO NOT EVER FABRICATE THE RESULTS OF TOOL CALLS!!!  Even if you think you know the answer, you must call the tool.

2. Thinking, Tool and Answer Tags:
   - Use <thinking></thinking> tags to show your analysis and reasoning process
     - When thinking, be concise; don't talk to the user, just think out loud to yourself
     - CRITICAL: ONLY ONE THINKING TAG PER MESSAGE!!!  If you want to think more, call a tool and then you can
       think more when you have the results.
   - Use <answer></answer> tags when you have a response for the user.  
     - This can be either a summary of your findings or a question to the user on how to proceed.
     - You can provide an <answer> in the same message as a <thinking> tag if you are done thinking and have an answer.
     - CRITICAL: IF THERE ARE TOOL CALLS IN YOUR CURRENT MESSAGE, YOU CAN'T PROVIDE AN ANSWER.
       YOU MUST WAIT FOR THE RESULTS AND ANSWER ON YOUR NEXT TURN.
   - You MUST end every full thought process (which can span multiple messages and tool calls) with 
     an <answer> to the user, wrapped in well formed <answer> and </answer> tags.  
   - Once you have sent your answer, the user will respond or ask a new question, and you can continue the conversation.

   CRITICAL REQUIREMENTS:
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
