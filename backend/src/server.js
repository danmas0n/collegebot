import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  exposedHeaders: ['x-api-key'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));
app.use(morgan('dev'));
app.use(express.json());

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createHash } from 'crypto';

// Helper function to create MCP client
const createMcpClient = async (serverName) => {
  let command, args;
  
  switch (serverName) {
    case 'college-data':
      command = 'node';
      args = ['../mcp/college-data-server/build/index.js'];
      break;
    case 'student-data':
      command = 'node';
      args = ['../mcp/student-data-server/build/index.js'];
      break;
    case 'fetch':
      command = 'npx';
      args = ['-y', '@modelcontextprotocol/server-fetch'];
      break;
    case 'memory':
      command = 'npx';
      args = ['-y', '@modelcontextprotocol/server-memory'];
      break;
    default:
      throw new Error(`Unknown MCP server: ${serverName}`);
  }

  const transport = new StdioClientTransport({
    command,
    args
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
const executeMcpTool = async (serverName, toolName, args) => {
  let client;
  try {
    console.log('Backend - Creating MCP client for:', serverName);
    client = await createMcpClient(serverName);
    console.log('Backend - MCP client created and connected');

    const request = {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    console.log('Backend - Sending MCP request:', request);

    const result = await client.request(request, CallToolResultSchema);
    console.log('Backend - Raw MCP response type:', typeof result);
    console.log('Backend - Raw MCP response keys:', result ? Object.keys(result) : 'null');
    console.log('Backend - Raw MCP response:', JSON.stringify(result, null, 2));

    if (!result) {
      throw new Error('MCP server returned null response');
    }

    return result;
  } catch (error) {
    // Extract the meaningful error message from MCP error chain
    let errorMessage = error.message;
    if (errorMessage.includes('MCP error -32603:')) {
      errorMessage = errorMessage.split('MCP error -32603:').pop().trim();
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

// Routes
// Helper function to generate a unique conversation ID
const generateConversationId = (colleges) => {
  const collegeNames = colleges.map(c => c.name).sort().join('|');
  return createHash('md5').update(collegeNames).digest('hex');
};

// Helper function to store college data in memory
const storeCollegeData = async (college) => {
  try {
    await executeMcpTool('memory', 'create_entities', {
      entities: [{
        name: college.name,
        entityType: 'college',
        observations: [
          JSON.stringify(college)
        ]
      }]
    });
  } catch (error) {
    console.error('Error storing college data:', error);
  }
};

app.post('/api/search', async (req, res) => {
  try {
    console.log('Backend - Received search request:', req.body);
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    try {
      // First, search using college-data server
      console.log('Backend - Starting college-data search for:', query);
      const result = await executeMcpTool('college-data', 'search_college_data', {
        query,
        includeWebSearch: true
      });

      console.log('Backend - Validating MCP response structure');
      if (!result?.content?.[0]?.text) {
        console.error('Backend - Invalid response format. Response:', result);
        throw new Error('Invalid response format from college-data server');
      }

      const data = JSON.parse(result.content[0].text);
      console.log('Backend - Successfully extracted data from response');
      console.log('Backend - Data structure:', {
        hasQuery: 'query' in data,
        resultsLength: data.results?.length
      });
      
      // Store results in memory if we have any
      if (data.results && Array.isArray(data.results)) {
        console.log('Backend - Storing', data.results.length, 'results in memory');
        for (const college of data.results) {
          await storeCollegeData(college);
        }
      }

      console.log('Backend - Sending successful response');
      res.json(data);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        error: 'Failed to search colleges',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search colleges' });
  }
});

// Helper function to get full CDS content
const getFullCdsContent = async (collegeName) => {
  try {
    const result = await executeMcpTool('college-data', 'get_cds_content', {
      collegeName
    });
    return result?.content?.[0]?.text || '';
  } catch (error) {
    console.error(`Error getting CDS content for ${collegeName}:`, error);
    return '';
  }
};

// Helper function to format college data for comparison
const formatCollegeDataForComparison = async (colleges) => {
  const formattedData = [];
  
  for (const college of colleges) {
    try {
      // Get detailed CDS data
      const cdsData = await executeMcpTool('college-data', 'get_cds_data', {
        collegeName: college.name
      });
      
      // Get full CDS content
      const fullContent = await getFullCdsContent(college.name);
      
      formattedData.push({
        name: college.name,
        sections: cdsData?.content?.[0]?.text ? JSON.parse(cdsData.content[0].text).sections : {},
        fullContent
      });
    } catch (error) {
      console.error(`Error formatting data for ${college.name}:`, error);
    }
  }
  
  return formattedData;
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, colleges } = req.body;
    
    if (!message || !colleges || !Array.isArray(colleges) || colleges.length === 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    // Get conversation ID based on the set of colleges
    const conversationId = generateConversationId(colleges);

    // Format college data for comparison
    const collegeData = await formatCollegeDataForComparison(colleges);

    // Store the message in memory
    await executeMcpTool('memory', 'create_entities', {
      entities: [{
        name: `chat_${Date.now()}`,
        entityType: 'message',
        observations: [
          JSON.stringify({
            conversationId,
            message,
            timestamp: new Date().toISOString()
          })
        ]
      }]
    });

    // Store or update college comparison data
    await executeMcpTool('memory', 'create_entities', {
      entities: [{
        name: `comparison_${conversationId}`,
        entityType: 'comparison',
        observations: [
          JSON.stringify({
            colleges: collegeData,
            timestamp: new Date().toISOString()
          })
        ]
      }]
    });

    // Generate response based on the question and college data
    let response = "Based on the Common Data Set information:\n\n";

    if (message.toLowerCase().includes('financial aid') || message.toLowerCase().includes('scholarship')) {
      response += collegeData.map(college => {
        const aid = college.sections?.financialAid || '';
        return `${college.name}:\n${aid}\n`;
      }).join('\n');
    } else if (message.toLowerCase().includes('expense') || message.toLowerCase().includes('cost')) {
      response += collegeData.map(college => {
        const expenses = college.sections?.expenses || '';
        return `${college.name}:\n${expenses}\n`;
      }).join('\n');
    } else if (message.toLowerCase().includes('admission')) {
      response += collegeData.map(college => {
        const admissions = college.sections?.admissions || '';
        return `${college.name}:\n${admissions}\n`;
      }).join('\n');
    } else {
      // General comparison
      response += collegeData.map(college => {
        return `${college.name}:\n` +
               `- Admissions: ${college.sections?.admissions ? 'Available' : 'Not available'}\n` +
               `- Financial Aid: ${college.sections?.financialAid ? 'Available' : 'Not available'}\n` +
               `- Expenses: ${college.sections?.expenses ? 'Available' : 'Not available'}\n`;
      }).join('\n');
    }

    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Student data endpoints
app.get('/api/students', async (req, res) => {
  try {
    const result = await executeMcpTool('student-data', 'get_students', {});
    const students = JSON.parse(result.content[0].text);
    res.json(students);
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { student } = req.body;
    const result = await executeMcpTool('student-data', 'save_student', { student });
    res.json({ message: 'Student saved successfully' });
  } catch (error) {
    console.error('Error saving student:', error);
    res.status(500).json({ error: 'Failed to save student' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeMcpTool('student-data', 'delete_student', { id });
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.post('/api/chat/claude', async (req, res) => {
  try {
    const { message, studentData, studentName, history } = req.body;
    console.log('Received headers:', req.headers);
    const apiKey = req.headers['x-api-key'] || req.headers['x-claude-api-key'];

    if (!apiKey) {
      console.error('Missing API key header');
      throw new Error('API key header is required');
    }

    console.log('API key present:', apiKey.substring(0, 4) + '...');

    // Prepare the system message
    const systemPrompt = `You are an AI college advisor helping a student named ${studentName}. 
You have access to their profile data and can use tools to fetch college information as needed.

Student Profile:
${JSON.stringify(studentData, null, 2)}

Available tools:

1. search_college_data
Description: Search for college data sources and information
Parameters:
- query (string, required): Search query for college data
- includeWebSearch (boolean, optional): Whether to include web search results

2. get_cds_data
Description: Get Common Data Set information for a specific college
Parameters:
- collegeName (string, required): Name of the college
- year (string, optional): Academic year (e.g., "2022-2023")

3. get_cds_content
Description: Get the full content of a stored CDS file
Parameters:
- collegeName (string, required): Name of the college

To use these tools, format your response like this:
<tool>search_college_data</tool>
<parameters>{"query": "Stanford University"}</parameters>

You can make multiple tool calls in your response if needed. After each tool call, I will provide you with the result, and you can continue with your response.

When answering questions about colleges, first search for relevant colleges if needed, then get their CDS data to provide accurate information. Focus on helping the student find colleges that match their profile, interests, and budget. Use the student's profile data to personalize your recommendations.

For questions about financial aid, scholarships, or costs, make sure to look up the specific sections in the CDS data. For admission-related questions, consider both the student's academic profile and the college's admission statistics.`;

    // Prepare the conversation messages
    const messages = [
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages,
        temperature: 0.7,
        system: systemPrompt
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Failed to get response from Claude API: ${errorText}`);
    }

    const result = await claudeResponse.json();
    console.log('Claude initial response:', result.content[0].text);
    let response = result.content[0].text;
    let thinking = [`Initial response: ${response}`];

    // Check for tool calls in the response
    const toolCalls = response.match(/<tool>.*?<\/tool>\s*<parameters>.*?<\/parameters>/gs);
    
    if (toolCalls) {
      // Create a new message array with the tool results
      const updatedMessages = [...messages];
      
      for (const toolCall of toolCalls) {
        const toolMatch = toolCall.match(/<tool>(.*?)<\/tool>/);
        const paramsMatch = toolCall.match(/<parameters>(.*?)<\/parameters>/);
        
        if (toolMatch && paramsMatch) {
          const toolName = toolMatch[1];
          const params = JSON.parse(paramsMatch[1]);
          
          try {
            // Execute the tool
            const toolResult = await executeMcpTool('college-data', toolName, params);
            const toolResponse = JSON.parse(toolResult.content[0].text);
            
            // Add the tool call and result to the conversation
            updatedMessages.push({
              role: 'assistant',
              content: `I'll use the ${toolName} tool with these parameters:\n${JSON.stringify(params, null, 2)}`
            });
            
            updatedMessages.push({
              role: 'user',
              content: `Tool result:\n${JSON.stringify(toolResponse, null, 2)}`
            });
          } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);
            updatedMessages.push({
              role: 'user',
              content: `Error executing ${toolName}: ${error.message}`
            });
          }
        }
      }
      
      // Get final response from Claude with tool results
      const finalResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: updatedMessages,
          temperature: 0.7,
          system: systemPrompt
        })
      });

      if (!finalResponse.ok) {
        throw new Error('Failed to get final response from Claude API');
      }

      const finalResult = await finalResponse.json();
      console.log('Claude final response:', finalResult.content[0].text);
      response = finalResult.content[0].text;
      thinking.push(`Final response: ${response}`);
    }

    res.json({ response, thinking });
  } catch (error) {
    console.error('Claude chat error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

app.get('/api/college/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await executeMcpTool('college-data', 'get_cds_data', {
      collegeName: name
    });

    res.json(result);
  } catch (error) {
    console.error('College data error:', error);
    res.status(500).json({ error: 'Failed to fetch college data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
