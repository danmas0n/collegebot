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
app.use(express.json({ limit: '50mb' }));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

// Helper function to find complete tag content
const findCompleteTagContent = (tagName, buffer) => {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  const startIndex = buffer.indexOf(startTag);
  const endIndex = buffer.indexOf(endTag);
  
  // Only process if we have both opening and closing tags
  if (startIndex === -1 || endIndex === -1) return null;
  
  // Get the content between the tags
  const contentStart = startIndex + startTag.length;
  const content = buffer.slice(contentStart, endIndex);
  
  return {
    fullMatch: buffer.slice(startIndex, endIndex + endTag.length),
    content: content
  };
};

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
      // temporary -- when mcp 1.1.4 is released remove --with
      args = ['--with','mcp==1.1.2','mcp-server-fetch'];
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
    const rawResponse = JSON.stringify(result, null, 2);
    console.log('Backend - Raw MCP response:', rawResponse.slice(0, 200) + (rawResponse.length > 200 ? '...' : ''));

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

// Helper function to format college data for comparison
const formatCollegeDataForComparison = async (colleges) => {
  const formattedData = [];
  
  for (const college of colleges) {
    try {
      // Get CDS data including sections and full content
      const cdsData = await executeMcpTool('college-data', 'get_cds_data', {
        collegeName: college.name
      });
      
      const parsedData = cdsData?.content?.[0]?.text ? JSON.parse(cdsData.content[0].text) : {};
      formattedData.push({
        name: college.name,
        sections: parsedData.sections || {},
        fullContent: parsedData.fullText || ''
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

// Memory MCP endpoints
app.post('/api/mcp/memory/create-entities', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'create_entities', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating entities:', error);
    res.status(500).json({ error: 'Failed to create entities' });
  }
});

app.post('/api/mcp/memory/create-relations', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'create_relations', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error creating relations:', error);
    res.status(500).json({ error: 'Failed to create relations' });
  }
});

app.post('/api/mcp/memory/read-graph', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'read_graph', {});
    res.json(JSON.parse(result.content[0].text));
  } catch (error) {
    console.error('Error reading graph:', error);
    res.status(500).json({ error: 'Failed to read graph' });
  }
});

app.post('/api/mcp/memory/delete-entities', async (req, res) => {
  try {
    const result = await executeMcpTool('memory', 'delete_entities', req.body);
    res.json(result);
  } catch (error) {
    console.error('Error deleting entities:', error);
    res.status(500).json({ error: 'Failed to delete entities' });
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
      hasStudentData: !!studentData,
      studentDataKeys: studentData ? Object.keys(studentData) : [],
      studentDataPreview: studentData ? JSON.stringify(studentData).slice(0, 200) + '...' : null
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
    //console.log('Backend - Student data being passed to prompt:', JSON.stringify(studentData, null, 2));
    const systemPrompt = generatePrompt(studentName, studentData);
    console.log('Backend - System prompt:', systemPrompt.slice(0, 500) + '...');
    console.log('Backend - System prompt length:', systemPrompt.length);

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com'
    });

    // Create user message with timestamp for local storage
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    // Get existing messages from current chat
    const existingMessages = currentChat?.messages || [];

    // Create initial messages array with user message
    const initialMessages = [...existingMessages, userMessage];

    // Update active chat with user message
    if (currentChat?.id) {
      const updatedChat = {
        ...currentChat,
        messages: initialMessages,
        updatedAt: new Date().toISOString(),
        studentId: studentData?.id || currentChat?.studentId
      };
      await executeMcpTool('student-data', 'save_chat', { 
        studentId: studentData?.id || currentChat?.studentId,
        chat: updatedChat
      });
    }

    // Filter and prepare messages for Claude context
    // Only include user messages and answers from history, exclude thinking/tool messages
    const claudeMessages = existingMessages
      .filter(msg => ['user', 'question', 'answer'].includes(msg.role))
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
    
    // Log preview of each message
    console.log('Backend - Claude chat history preview:');
    claudeMessages.forEach((msg, i) => {
      console.log(`[${i}] ${msg.role}: ${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
    });

    // Helper function to process a single stream
    const processStream = async (currentMessages) => {
      console.log('Backend - Starting Claude stream');
      let toolBuffer = '';
      let messageContent = '';
      let hasToolCalls = false;
      let savedAnswer = null;
      let continueProcessing = true;
      
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
            messageContent = '';
          }
          else if (streamEvent.type === 'content_block_start') {
            console.log('Backend - Content block start');
          }
          else if (streamEvent.type === 'content_block_delta' && streamEvent.delta.type === 'text_delta') {
            const text = streamEvent.delta.text;
            toolBuffer += text;
            
            // Process any complete tags in the buffer
            const processTag = (tagName, type) => {
              let result;
              while ((result = findCompleteTagContent(tagName, toolBuffer))) {
                if (tagName === 'answer') {
                  savedAnswer = result.content;
                  currentMessages.push({
                    role: 'answer',
                    content: result.content
                  });
                  sendSSE({ 
                    type: 'response', 
                    content: result.content
                  });
                } else {
                  sendSSE({ 
                    type, 
                    content: result.content
                  });
                }
                console.log(`Backend - Found complete ${tagName} tag:`, result.content);
                toolBuffer = toolBuffer.replace(result.fullMatch, '');
              }
            };

            processTag('thinking', 'thinking');
            processTag('answer', 'response');

            // If we have non-tag content, accumulate it
            if (!toolBuffer.includes('<')) {
              messageContent += toolBuffer;
              toolBuffer = '';
            }
          }
          else if (streamEvent.type === 'message_stop') {
            console.log('Backend - Message complete');
             
            // At message_stop, check if we received any content
            if (!toolBuffer.trim() && !messageContent.trim()) {
              console.log('Backend - No content received, skipping processing');
              return { hasToolCalls, messages: currentMessages, continueProcessing: false };
            }

            console.log('Backend - Processing message content');
            console.log('Backend - Message buffer:', toolBuffer);
            console.log('Backend - Message content:', messageContent);

            // Combine remaining content to check for tags
            const combinedContent = toolBuffer + messageContent;
            toolBuffer = combinedContent;
            messageContent = '';

            // Check for complete tool calls
            const toolCallMatches = [];
            let toolResult;
            while ((toolResult = findCompleteTagContent('tool', toolBuffer))) {
              toolCallMatches.push([toolResult.fullMatch, toolResult.content]);
              toolBuffer = toolBuffer.replace(toolResult.fullMatch, '');
            }
            console.log('Backend - Found tool calls:', toolCallMatches.length);

            // Process any complete tool calls
            if (toolCallMatches.length > 0) {
              console.log('Backend - Processing complete tool calls');
              hasToolCalls = true;
              
              for (const match of toolCallMatches) {
                const toolCall = match[0]; // Full tool tag content
                const toolContent = match[1]; // Content between tool tags
                console.log('Backend - Processing tool call:', toolCall);
                
                try {
                  const nameMatch = toolContent.match(/<name>(.*?)<\/name>/s);
                  const paramsMatch = toolContent.match(/<parameters>([\s\S]*?)<\/parameters>/);
                  
                  console.log('Backend - Tool call parsing:', {
                    nameMatch: nameMatch?.[1],
                    paramsMatch: paramsMatch?.[1]?.trim()
                  });
                  
                  if (!nameMatch || !paramsMatch) {
                    throw new Error('Malformed tool call - missing name or parameters');
                  }

                  const toolName = nameMatch[1].trim();
                  
                  try {
                    const params = JSON.parse(paramsMatch[1].trim());
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
                      // Add tool result to conversation for Claude (without timestamp)
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
                    // Add error message to conversation for Claude
                    currentMessages.push({
                      role: 'user',
                      content: `Tool ${toolName} error: ${error.message}`
                    });
                    // Send error to frontend
                    sendSSE({ 
                      type: 'thinking',
                      content: `Error executing tool: ${error.message}`
                    });
                  }
                } catch (error) {
                  console.error(`Error parsing tool call:`, error);
                  // Add error message to conversation for Claude
                  currentMessages.push({
                    role: 'user',
                    content: `Tool call error: ${error.message}`
                  });
                  // Send error to frontend
                  sendSSE({ 
                    type: 'thinking',
                    content: `Error parsing tool call: ${error.message}`
                  });
                }
              }
            }

            // Check for any remaining tool calls
            const remainingToolCalls = toolBuffer.match(/<tool>[\s\S]*?<\/tool>/g);
            
            // If we have tool calls, process them and continue
            if (remainingToolCalls || toolCallMatches.length > 0) {
              console.log('Backend - Message analysis:', {
                remainingToolCalls: remainingToolCalls?.length || 0,
                toolCallMatches: toolCallMatches.length,
                hasCompleteAnswer: !!savedAnswer
              });
              continueProcessing = true;
              hasToolCalls = !!remainingToolCalls;
              return { hasToolCalls, messages: currentMessages, continueProcessing };
            }

            // No tool calls, check for remaining content
            const remainingContent = toolBuffer.trim();
            if (!savedAnswer && remainingContent) {
              console.log('Backend - Converting remaining content to question:', remainingContent);
              currentMessages.push({
                role: 'question',
                content: remainingContent
              });
              sendSSE({ 
                type: 'response', 
                content: remainingContent
              });
            }

            // No more processing needed
            console.log('Backend - Message analysis:', {
              remainingToolCalls: 0,
              hasCompleteAnswer: !!savedAnswer,
              continueProcessing: false,
              hasToolCalls: false
            });
            continueProcessing = false;
            hasToolCalls = false;
          }
          else if (streamEvent.type === 'error') {
            sendSSE({ type: 'error', content: streamEvent.error.message });
          }
        }

        return { hasToolCalls, messages: currentMessages, continueProcessing };
      } catch (error) {
        console.error('Backend - Error in stream processing:', error);
        sendSSE({ type: 'error', content: error.message });
        throw error; // Re-throw to be caught by outer try-catch
      }
    };

    try {
      let currentMessages = claudeMessages;
      let continueProcessing = true;

      while (continueProcessing) {
        console.log('Backend - Processing message with current state:', {
          messageCount: currentMessages.length,
          continueProcessing
        });
        
        // Map our roles to Claude's roles before sending
        const claudeFormattedMessages = currentMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
        
        const result = await processStream(claudeFormattedMessages);
        currentMessages = result.messages;
        continueProcessing = result.continueProcessing;

        if (!continueProcessing) {
          console.log('Backend - All processing complete');
          
          // Send final completion event
          console.log('Backend - Sending completion event');
          sendSSE({ type: 'complete' });

          // Save final chat history if we have both student ID and chat data
          if (currentChat?.id && studentData?.id) {
            try {
              // Add timestamps to messages before saving
              const messagesWithTimestamps = currentMessages.map(msg => ({
                ...msg,
                timestamp: new Date().toISOString()
              }));

              const updatedChat = {
                ...currentChat,
                messages: messagesWithTimestamps,
                updatedAt: new Date().toISOString(),
                studentId: studentData?.id || currentChat?.studentId
              };
              console.log('Backend - Saving complete chat history with messages:', messagesWithTimestamps.length);
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
