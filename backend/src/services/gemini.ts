import { GoogleGenerativeAI } from '@google/generative-ai';
import { findCompleteTagContent } from '../utils/helpers.js';
import { executeMcpTool } from './mcp.js';
import { toolServerMap } from '../config/mcp-tools.js';

interface Message {
  role: 'user' | 'assistant' | 'answer' | 'question';
  content: string;
}

type ToolName = keyof typeof toolServerMap;

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash" 
    });
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;

    while (continueProcessing) {
      console.info('Processing message with current state', {
        messageCount: messages.length,
        continueProcessing
      });

      const result = await this.processSingleStream(messages, systemPrompt, sendSSE);
      messages = result.messages;
      continueProcessing = result.continueProcessing;
    }

    return messages;
  }

  async processSingleStream(messages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    console.info('Starting Gemini stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let savedAnswer: string | null = null;
    let continueProcessing = true;
    let isFirstAnswer = messages.filter(msg => msg.role === 'assistant').length === 0;

    try {
      // Format messages for Gemini
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // If this is the first answer, append title request
      if (isFirstAnswer) {
        systemPrompt += '\n\nAfter providing your answer, suggest a brief, descriptive title for this chat based on the discussion. Format it as: <title>Your suggested title</title>';
      }

      // Add system prompt to the beginning
      history.unshift({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });

      console.info('System prompt', {
        preview: systemPrompt.slice(0, 200),
        totalLength: systemPrompt.length
      });

      // Start chat and generate response
      const chat = this.model.startChat({ history });
      const result = await chat.sendMessageStream(
        messages[messages.length - 1]?.content || 'Hello'
      );

      // Track tool calls across chunks
      const toolCallMatches: [string, string][] = [];

      for await (const chunk of result.stream) {
        const text = chunk.text();
        toolBuffer += text;

        // Process any complete tags in the buffer
        const processTag = (tagName: string, type: string) => {
          let result;
          while ((result = findCompleteTagContent(tagName, toolBuffer))) {
            if (tagName === 'answer') {
              savedAnswer = result.content;
              messages.push({
                role: 'answer',
                content: result.content
              });
              // Only send the SSE if we haven't seen a title tag yet
              if (!isFirstAnswer) {
                sendSSE({ 
                  type: 'response', 
                  content: result.content
                });
              }
            } else if (tagName === 'title' && isFirstAnswer) {
              // When we get the title, send both the saved answer and title together
              sendSSE({
                type: 'response',
                content: savedAnswer,
                suggestedTitle: result.content.trim()
              });
              isFirstAnswer = false;
            } else if (tagName === 'thinking') {
              sendSSE({ 
                type: 'thinking', 
                content: result.content
              });
            }
            console.info(`Found complete ${tagName} tag`, { content: result.content });
            toolBuffer = toolBuffer.replace(result.fullMatch, '');
          }
        };

        processTag('thinking', 'thinking');
        processTag('answer', 'response');
        processTag('title', 'response');

        // If we have non-tag content, accumulate it
        if (!toolBuffer.includes('<')) {
          messageContent += toolBuffer;
          toolBuffer = '';
        }

        // Check for complete tool calls
        let toolResult;
        while ((toolResult = findCompleteTagContent('tool', toolBuffer))) {
          toolCallMatches.push([toolResult.fullMatch, toolResult.content]);
          toolBuffer = toolBuffer.replace(toolResult.fullMatch, '');
        }

        // Process any complete tool calls
        if (toolCallMatches.length > 0) {
          console.info('Processing complete tool calls');
          hasToolCalls = true;
          
          for (const [toolCall, toolContent] of toolCallMatches) {
            console.info('Processing tool call', { toolCall });
            
            try {
              const nameMatch = toolContent.match(/<name>(.*?)<\/name>/s);
              const paramsMatch = toolContent.match(/<parameters>([\s\S]*?)<\/parameters>/);
              
              if (!nameMatch || !paramsMatch) {
                throw new Error('Malformed tool call - missing name or parameters');
              }

              const toolName = nameMatch[1].trim() as ToolName;
              
              try {
                const params = JSON.parse(paramsMatch[1].trim());

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
                console.info('Starting tool execution', { server, toolName, params });
                const toolResult = await executeMcpTool(server, toolName, params);
                console.info('Tool execution successful, processing result');

                // Process tool result
                if (toolResult?.content?.[0]?.text) {
                  // Add tool result to conversation
                  messages.push({
                    role: 'user',
                    content: `Tool ${toolName} returned: ${toolResult.content[0].text}`
                  });

                  // Send tool result to frontend
                  try {
                    // Try to parse as JSON for pretty printing
                    const text = toolResult.content[0].text;
                    if (text && typeof text === 'string') {
                      const parsedResult = JSON.parse(text);
                      sendSSE({ 
                        type: 'thinking',
                        content: `Tool ${toolName} result:`,
                        toolData: JSON.stringify(parsedResult, null, 2)
                      });
                    } else {
                      throw new Error('Invalid tool result text format');
                    }
                  } catch {
                    // If parsing fails, send as-is
                    sendSSE({ 
                      type: 'thinking',
                      content: `Tool ${toolName} result:`,
                      toolData: toolResult.content[0].text
                    });
                  }

                  toolBuffer = toolBuffer.replace(toolCall, '').trim();
                } else {
                  console.error('Invalid tool result format', { toolResult });
                  throw new Error('Invalid tool result format');
                }
              } catch (error: any) {
                console.error('Error executing tool', { error: error.message, stack: error.stack });
                messages.push({
                  role: 'user',
                  content: `Tool ${toolName} error: ${error.message}`
                });
                sendSSE({ 
                  type: 'thinking',
                  content: `Error executing tool: ${error.message}`
                });
                // Clear the tool buffer and continue processing
                toolBuffer = toolBuffer.replace(toolCall, '').trim();
                // Set hasToolCalls to false so we can process any remaining content
                hasToolCalls = false;
              }
            } catch (error: any) {
              console.error('Error parsing tool call', { error: error.message, stack: error.stack });
              messages.push({
                role: 'user',
                content: `Tool call error: ${error.message}`
              });
              sendSSE({ 
                type: 'thinking',
                content: `Error parsing tool call: ${error.message}`
              });
              // Clear the tool buffer and continue processing
              toolBuffer = toolBuffer.replace(toolCall, '').trim();
              // Set hasToolCalls to false so we can process any remaining content
              hasToolCalls = false;
            }
          }
        }
      }

      // Check for any remaining tool calls
      const remainingToolCalls = toolBuffer.match(/<tool>[\s\S]*?<\/tool>/g);

      // If we have tool calls, process them and continue
      if (remainingToolCalls || toolCallMatches.length > 0) {
        console.info('Message analysis', {
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
        console.info('Converting remaining content to question', { content: remainingContent });
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
      console.info('Message analysis', {
        remainingToolCalls: 0,
        hasCompleteAnswer: !!savedAnswer,
        continueProcessing: false,
        hasToolCalls: false
      });
      continueProcessing = false;
      hasToolCalls = false;

      return { hasToolCalls, messages, continueProcessing };
    } catch (error: any) {
      console.error('Error in stream processing', { error: error.message, stack: error.stack });
      sendSSE({ type: 'error', content: error.message });
      throw error;
    }
  }

  async analyzeChatHistory(chat: any, systemPrompt: string, sendSSE: (data: any) => void) {
    const messages = [
      ...chat.messages.filter((msg: any) => msg.content).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content?.trim() || ''
      })),
      {
        role: 'user',
        content: `Please process this chat according to the instructions. Here is the chat content:\n${JSON.stringify(chat, null, 2)}`
      }
    ];

    console.info('Messages being sent to Gemini', { messages });
    
    await this.processStream(messages, systemPrompt, sendSSE);
  }
}
