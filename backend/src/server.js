import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import { generatePrompt } from './prompts/prompt.js';

// Load environment variables
config();

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
import Anthropic from '@anthropic-ai/sdk';

// Helper function to create MCP client
const createMcpClient = async (serverName) => {
  // Base environment with PATH
  let env = { PATH: process.env.PATH };
  let command, args;
  
  switch (serverName) {
    case 'college-data':
      command = 'node';
      args = ['../mcp/college-data-server/build/index.js'];
      env = {
        ...env,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID
      };
      break;
    case 'student-data':
      command = 'node';
      args = ['../mcp/student-data-server/build/index.js'];
      break;
    case 'fetch':
      command = 'uvx';
      args = ['@modelcontextprotocol/mcp-server-fetch'];
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

      try {
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
        // If parsing fails, send the raw text
        console.log('Backend - Sending raw response');
        res.json({ text: result.content[0].text });
      }
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
      try {
        const students = JSON.parse(result.content[0].text);
        res.json(students);
      } catch {
        res.json({ text: result.content[0].text });
      }
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
      try {
        const chats = JSON.parse(result.content[0].text);
        res.json({ chats });
      } catch {
        res.json({ text: result.content[0].text });
      }
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
    const { message, studentData, studentName, history, currentChat } = req.body;
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

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com'
    });

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

    // Helper function to process a single stream
    const processStream = async (currentMessages) => {
      console.log('Backend - Starting Claude stream');
      let toolBuffer = '';
      let hasToolCalls = false;
      
      try {
        const stream = await anthropic.messages.stream({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: currentMessages,
          system: systemPrompt,
          temperature: 0
        });

        for await (const streamEvent of stream) {
          if (streamEvent.type === 'message_start') {
            console.log('Backend - Message start');
            toolBuffer = '';
          }
          else if (streamEvent.type === 'content_block_delta' && streamEvent.delta.type === 'text_delta') {
            const text = streamEvent.delta.text;
            //console.log('Backend - Received text delta:', text);
            
            // Accumulate text
            toolBuffer += text;
            
            // Check for any partial or incomplete tags
            const hasOpenTag = toolBuffer.includes('<');
            const hasCloseTag = toolBuffer.includes('>');
            const hasPartialTag = hasOpenTag && (
              // Check for incomplete tag structure
              !hasCloseTag ||
              // Check for incomplete tool tags
              (toolBuffer.includes('<tool') && !toolBuffer.includes('</tool>')) ||
              // Check for incomplete thinking tags
              (toolBuffer.includes('<thinking') && !toolBuffer.includes('</thinking>')) ||
              // Check for incomplete answer tags
              (toolBuffer.includes('<answer') && !toolBuffer.includes('</answer>'))
            );
            /*console.log('Backend - Buffer analysis:', {
              hasOpenTag,
              hasCloseTag,
              hasPartialTag,
              bufferLength: toolBuffer.length,
              bufferContent: toolBuffer
            });*/

            if (!hasPartialTag) {
              // Process any complete thinking tags
              let thinkingMatch;
              while ((thinkingMatch = toolBuffer.match(/<thinking>(.*?)<\/thinking>/s))) {
                sendSSE({ 
                  type: 'thinking', 
                  content: thinkingMatch[1].trim()
                });
                toolBuffer = toolBuffer.replace(thinkingMatch[0], '');
              }

              // Process any complete answer tags
              let answerMatch;
              while ((answerMatch = toolBuffer.match(/<answer>(.*?)<\/answer>/s))) {
                sendSSE({ 
                  type: 'response', 
                  content: answerMatch[1].trim()
                });
                toolBuffer = toolBuffer.replace(answerMatch[0], '');
              }
            }

            // Only send non-tag content if we're sure it's not part of a tag
            if (!toolBuffer.includes('<') && toolBuffer.trim()) {
              console.log('Backend - Safe to send as thinking:', toolBuffer.trim());
              sendSSE({ 
                type: 'thinking', 
                content: toolBuffer.trim()
              });
              toolBuffer = '';
            } else {
              //console.log('Backend - Accumulating content for potential tags');
            }
          }
          else if (streamEvent.type === 'message_stop') {
            console.log('Backend - Message complete');
            console.log('Backend - Complete message from Claude:', toolBuffer);
            
            // First, check if there's any non-tool content to send
            const beforeToolContent = toolBuffer.split('<tool>')[0].trim();
            if (beforeToolContent) {
              console.log('Backend - Sending remaining content before tool call:', beforeToolContent);
              sendSSE({ 
                type: 'thinking', 
                content: beforeToolContent
              });
            }

            // Check if we have any complete tool calls
            console.log('Backend - Message buffer:', toolBuffer);
            const toolCallMatches = Array.from(toolBuffer.matchAll(/<tool>([\s\S]*?)<\/tool>/g));
            console.log('Backend - Found tool calls:', toolCallMatches.length);
            
            if (toolCallMatches.length > 0) {
              console.log('Backend - Processing complete tool calls');
              hasToolCalls = true;
              
              // Process each complete tool call
              for (const match of toolCallMatches) {
                const toolCall = match[0]; // Full tool tag content
                const toolContent = match[1]; // Content between tool tags
                console.log('Backend - Processing tool call:', toolCall);
                
                try {
                  const nameMatch = toolContent.match(/<name>(.*?)<\/name>/);
                  const paramsMatch = toolContent.match(/<parameters>(.*?)(?:<\/parameters>|>)/);
                  
                  if (!nameMatch || !paramsMatch) {
                    throw new Error('Malformed tool call - missing name or parameters');
                  }

                  const toolName = nameMatch[1];
                  const params = JSON.parse(paramsMatch[1]);
                  console.log('Backend - Valid tool call found:', { toolName, params });

                  // Determine which MCP server to use
                  let serverName;
                  switch (toolName) {
                    case 'search_college_data':
                    case 'get_cds_data':
                    case 'get_cds_content':
                      serverName = 'college-data';
                      break;
                    case 'fetch':
                      serverName = 'fetch';
                      break;
                    default:
                      throw new Error(`Unknown tool: ${toolName}`);
                  }

                  // Send tool use notification
                  sendSSE({ 
                    type: 'thinking', 
                    content: `Using ${toolName} tool...`,
                    toolData: JSON.stringify(params, null, 2)
                  });

                  // Execute tool
                  console.log('Backend - Starting tool execution:', { serverName, toolName, params });
                  const toolResult = await executeMcpTool(serverName, toolName, params);
                  console.log('Backend - Tool execution successful, processing result');

                  // Process tool result
                  if (toolResult?.content?.[0]?.text) {
                    // Add tool result to conversation for Claude
                    currentMessages.push({
                      role: 'user',
                      content: `Tool ${toolName} returned: ${toolResult.content[0].text}`
                    });

                    // Send tool result to frontend
                    try {
                      // Try to parse as JSON for pretty printing
                      const parsedResult = JSON.parse(toolResult.content[0].text);
                      sendSSE({ 
                        type: 'thinking',
                        content: `Tool ${toolName} result:`,
                        toolData: JSON.stringify(parsedResult, null, 2)
                      });
                    } catch {
                      // If parsing fails, send as-is
                      sendSSE({ 
                        type: 'thinking',
                        content: `Tool ${toolName} result:`,
                        toolData: toolResult.content[0].text
                      });
                    }

                    // Remove processed tool call from buffer and any whitespace
                    toolBuffer = toolBuffer.replace(toolCall, '').trim();
                    console.log('Backend - Updated buffer after tool call:', toolBuffer);
                  } else {
                    console.error('Backend - Invalid tool result format:', toolResult);
                    throw new Error('Invalid tool result format');
                  }
                } catch (error) {
                  console.error(`Error executing tool:`, error);
                  sendSSE({ 
                    type: 'thinking',
                    content: `Error executing tool: ${error.message}`
                  });
                }
              }
            }

            // Check for any remaining content after tool calls
            if (toolCallMatches.length > 0) {
              const afterToolContent = toolBuffer.split('</tool>').pop()?.trim();
              if (afterToolContent) {
                console.log('Backend - Sending remaining content after tool calls:', afterToolContent);
                sendSSE({ 
                  type: 'thinking', 
                  content: afterToolContent
                });
              }
            }

            // Check for complete tags
            const answerMatch = toolBuffer.match(/<answer>([\s\S]*?)<\/answer>/);
            const remainingToolCalls = toolBuffer.match(/<tool>[\s\S]*?<\/tool>/g);
            
            console.log('Backend - Message analysis:', {
              remainingToolCalls: remainingToolCalls?.length || 0,
              hasCompleteAnswer: !!answerMatch,
              bufferLength: toolBuffer.length
            });

            if (answerMatch) {
              console.log('Backend - Found complete answer:', answerMatch[0]);
            }

            if (remainingToolCalls) {
              // Still have tool calls to process
              console.log('Backend - Tool calls remaining, continuing processing');
              hasToolCalls = true;
            } else if (!answerMatch) {
              // No tool calls but waiting for complete answer
              console.log('Backend - Waiting for complete answer');
              hasToolCalls = true;
            } else {
              // No more tool calls and have complete answer
              console.log('Backend - Processing complete with answer');
              hasToolCalls = false;
            }
            toolBuffer = toolBuffer.trim();
          }
          else if (streamEvent.type === 'error') {
            sendSSE({ type: 'error', content: streamEvent.error.message });
          }
        }

        return { hasToolCalls, messages: currentMessages };
      } catch (error) {
        console.error('Backend - Error in stream processing:', error);
        sendSSE({ type: 'error', content: error.message });
        throw error; // Re-throw to be caught by outer try-catch
      }
    };

    try {
      let currentMessages = messages;
      let continueProcessing = true;

      while (continueProcessing) {
        console.log('Backend - Processing message with current state:', {
          messageCount: currentMessages.length,
          continueProcessing
        });
        
        const result = await processStream(currentMessages);
        currentMessages = result.messages;
        continueProcessing = result.hasToolCalls;

        if (!continueProcessing) {
          console.log('Backend - All processing complete');
          
          // Send final completion event
          console.log('Backend - Sending completion event');
          sendSSE({ type: 'complete' });

          // Save final chat history if we have both student ID and chat data
          if (currentChat?.id && studentData?.id) {
            try {
              const updatedChat = {
                ...currentChat,
                messages: currentMessages.filter(msg => msg.role !== 'thinking'),
                updatedAt: new Date().toISOString()
              };
              await executeMcpTool('student-data', 'save_chat', { 
                studentId: studentData.id,
                chat: updatedChat
              });
            } catch (error) {
              console.error('Failed to save chat:', error);
              // Continue even if save fails
            }
          }
        }
      }
    } catch (error) {
      console.error('Backend - Error processing chat:', error);
      sendSSE({ type: 'error', content: error.message });
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
