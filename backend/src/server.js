import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { generatePrompt } from './prompts/prompt.js';

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

// Chat management endpoints
app.post('/api/chat/claude/chats', async (req, res) => {
  try {
    const { studentId } = req.body;
    const result = await executeMcpTool('student-data', 'get_chats', { studentId });
    const chats = JSON.parse(result.content[0].text);
    res.json({ chats });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

app.post('/api/chat/claude/chat', async (req, res) => {
  try {
    const { studentId, chat } = req.body;
    await executeMcpTool('student-data', 'save_chat', { studentId, chat });
    res.json({ message: 'Chat saved successfully' });
  } catch (error) {
    console.error('Error saving chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

app.delete('/api/chat/claude/chat', async (req, res) => {
  try {
    const { studentId, chatId } = req.body;
    await executeMcpTool('student-data', 'delete_chat', { studentId, chatId });
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

app.post('/api/chat/claude/message', async (req, res) => {
  try {
    console.log('Backend - Claude chat request received');
    const { message, studentData, studentName, history } = req.body;
    const apiKey = req.headers['x-api-key'] || req.headers['x-claude-api-key'];

    console.log('Backend - Request details:', {
      hasMessage: !!message,
      messageLength: message?.length,
      studentName,
      historyLength: history?.length,
      hasApiKey: !!apiKey,
      hasStudentData: !!studentData
    });

    if (!apiKey) {
      console.error('Backend - Missing API key');
      throw new Error('API key header is required');
    }

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Helper function to send SSE data
    const sendSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Generate the system prompt
    console.log('Backend - Generating system prompt');
    const systemPrompt = generatePrompt(studentName, studentData);
    console.log('Backend - System prompt length:', systemPrompt.length);

    // Prepare conversation messages
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

    console.log('Backend - Preparing Claude API request');
    const claudeRequest = {
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
        system: systemPrompt,
        stream: true
      })
    };
    console.log('Backend - Claude request config:', {
      url: 'https://api.anthropic.com/v1/messages',
      headers: Object.keys(claudeRequest.headers),
      bodyLength: claudeRequest.body.length
    });

    // Call Claude API with streaming enabled
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', claudeRequest);
    
    console.log('Backend - Claude API response:', {
      status: claudeResponse.status,
      headers: Object.fromEntries(claudeResponse.headers.entries())
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Backend - Claude API error:', {
        status: claudeResponse.status,
        error: errorText
      });
      throw new Error(`Failed to get response from Claude API: ${errorText}`);
    }

    // Process the stream
    const reader = claudeResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new data to buffer and split into lines
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep last partial line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
            
            if (data.type === 'message_start') {
              sendSSE({ type: 'thinking', content: 'Starting to process your request...' });
            }
            else if (data.type === 'content_block_delta' && data.delta.type === 'text_delta') {
              const text = data.delta.text;
              const toolCallMatch = text.match(/<tool>(.*?)<\/tool>\s*<parameters>(.*?)<\/parameters>/s);
              
              if (toolCallMatch) {
                const toolName = toolCallMatch[1];
                const params = JSON.parse(toolCallMatch[2]);

                try {
                  // Log tool call
                  console.log('Backend - Tool call:', {
                    tool: toolName,
                    params: params
                  });

                  // Execute tool
                  const toolResult = await executeMcpTool('college-data', toolName, params);
                  const toolResponse = JSON.parse(toolResult.content[0].text);
                  
                  // Send tool use and response
                  const toolUseMessage = { 
                    type: 'thinking', 
                    content: `Using ${toolName} tool...`,
                    toolData: JSON.stringify(params, null, 2)
                  };
                  sendSSE(toolUseMessage);
                  console.log('Backend - Tool use message:', toolUseMessage);

                  const toolResultMessage = { 
                    type: 'thinking',
                    content: `Tool result:`,
                    toolData: JSON.stringify(toolResponse, null, 2)
                  };
                  sendSSE(toolResultMessage);
                  console.log('Backend - Tool result message:', toolResultMessage);

                  // Add to conversation
                  messages.push({
                    role: 'assistant',
                    content: `Tool result:\n${JSON.stringify(toolResponse, null, 2)}`
                  });
                } catch (error) {
                  console.error(`Error executing tool ${toolName}:`, error);
                  sendSSE({ 
                    type: 'thinking',
                    content: `Error using ${toolName}: ${error.message}`
                  });
                }
              } else {
                // Forward Claude's text
                const thinkingMessage = { type: 'thinking', content: text };
                sendSSE(thinkingMessage);
                
                // Log complete thinking messages (sentences)
                if (text.match(/[.!?]\s*$/)) {
                  console.log('Backend - Complete thinking message:', thinkingMessage);
                }
                
                // Also add to messages for final response
                messages.push({
                  role: 'assistant',
                  content: text
                });
              }
            }
            else if (data.type === 'message_delta' && data.delta.role === 'assistant') {
              // This is the final response
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                const responseMessage = {
                  type: 'response',
                  content: lastMessage.content
                };
                sendSSE(responseMessage);
                console.log('Backend - Final response:', responseMessage);
              }
            }
            else if (data.type === 'error') {
              sendSSE({ type: 'error', content: data.content });
            }
          } catch (error) {
            console.error('Backend - Error parsing SSE data:', error);
          }
        }
      }
    } catch (error) {
      console.error('Backend - Error processing stream:', error);
      sendSSE({ type: 'error', content: error.message });
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Backend - Claude chat error:', error);
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
