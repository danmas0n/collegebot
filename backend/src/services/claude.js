import Anthropic from '@anthropic-ai/sdk';
import { findCompleteTagContent } from '../utils/helpers.js';
import { executeMcpTool } from '../utils/mcp.js';
import { toolServerMap } from '../config/mcp-tools.js';

export class ClaudeService {
  constructor(apiKey) {
    this.client = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com'
    });
  }

  async processStream(initialMessages, systemPrompt, sendSSE) {
    let messages = [...initialMessages];
    let continueProcessing = true;

    while (continueProcessing) {
      console.log('Backend - Processing message with current state:', {
        messageCount: messages.length,
        continueProcessing
      });

      const result = await this.processSingleStream(messages, systemPrompt, sendSSE);
      messages = result.messages;
      continueProcessing = result.continueProcessing;
    }

    return messages;
  }

  async processSingleStream(messages, systemPrompt, sendSSE) {
    console.log('Backend - Starting Claude stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let savedAnswer = null;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message

    try {
      // Map our roles to Claude's roles before sending
      const claudeMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      console.log('Backend - System prompt:', {
        preview: systemPrompt.slice(0, 1000),
        totalLength: systemPrompt.length
      });

      const stream = await this.client.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: claudeMessages,
        system: systemPrompt,
        temperature: 0
      });

      for await (const streamEvent of stream) {
        if (streamEvent.type === 'message_start') {
          console.log('Backend - Message start');
          toolBuffer = '';
          messageContent = '';
          rawMessage = ''; // Reset raw message buffer
        }
        else if (streamEvent.type === 'content_block_start') {
          console.log('Backend - Content block start');
        }
        else if (streamEvent.type === 'content_block_delta' && streamEvent.delta.type === 'text_delta') {
          const text = streamEvent.delta.text;
          toolBuffer += text;
          rawMessage += text; // Accumulate raw message
          
          // Process any complete tags in the buffer
          const processTag = (tagName, type) => {
            let result;
            while ((result = findCompleteTagContent(tagName, toolBuffer))) {
              if (tagName === 'answer') {
                savedAnswer = result.content;
                messages.push({
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
          
          // Log complete raw message before processing
          console.log('Backend - Complete raw message:', rawMessage);
           
          // At message_stop, check if we received any content
          if (!toolBuffer.trim() && !messageContent.trim()) {
            console.log('Backend - No content received, skipping processing');
            return { hasToolCalls, messages, continueProcessing: false };
          }

          //console.log('Backend - Processing message content');
          //console.log('Backend - Message buffer:', toolBuffer);
          //console.log('Backend - Message content:', messageContent);

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
              console.log('Backend - Processing tool call:\n', toolCall);
              
              try {
                const nameMatch = toolContent.match(/<name>(.*?)<\/name>/s);
                const paramsMatch = toolContent.match(/<parameters>([\s\S]*?)<\/parameters>/);
                
                if (!nameMatch || !paramsMatch) {
                  throw new Error('Malformed tool call - missing name or parameters');
                }

                const toolName = nameMatch[1].trim();
                
                try {
                  const params = JSON.parse(paramsMatch[1].trim());
                  //console.log('Backend - Valid tool call found:', { toolName, params });

                  // Get the appropriate server for this tool
                  const server = toolServerMap[toolName];
                  if (!server) {
                    throw new Error(`Unknown tool: ${toolName}`);
                  }

                  // Send tool use notification
                  sendSSE({ 
                    type: 'thinking', 
                    content: `Using ${toolName} tool...`,
                    toolData: JSON.stringify(params, null, 2)
                  });

                  // Execute tool
                  console.log('Backend - Starting tool execution:', { server, toolName, params });
                  const toolResult = await executeMcpTool(server, toolName, params);
                  console.log('Backend - Tool execution successful, processing result');

                  // Process tool result
                  if (toolResult?.content?.[0]?.text) {
                    // Add tool result to conversation for Claude
                    messages.push({
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
                    //console.log('Backend - Updated buffer after tool call:', toolBuffer);
                  } else {
                    console.error('Backend - Invalid tool result format:', toolResult);
                    throw new Error('Invalid tool result format');
                  }
                } catch (error) {
                  console.error(`Error executing tool:`, error);
                  // Add error message to conversation for Claude
                  messages.push({
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
                messages.push({
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
            return { hasToolCalls, messages, continueProcessing };
          }

          // No tool calls, check for remaining content
          const remainingContent = toolBuffer.trim();
          if (!savedAnswer && remainingContent) {
            console.log('Backend - Converting remaining content to question:', remainingContent);
            messages.push({
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

      return { hasToolCalls, messages, continueProcessing };
    } catch (error) {
      console.error('Backend - Error in stream processing:', error);
      sendSSE({ type: 'error', content: error.message });
      throw error;
    }
  }

  async analyzeChatHistory(chat, systemPrompt, sendSSE) {
    const messages = [
      ...chat.messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content.trim()
      })),
      {
        role: 'user',
        content: `Please process this chat according to the instructions. Here is the chat content:\n${JSON.stringify(chat, null, 2)}`
      }
    ];

    console.log('Backend - Messages being sent to Claude:', messages);
    
    await this.processStream(messages, systemPrompt, sendSSE);
  }
}
