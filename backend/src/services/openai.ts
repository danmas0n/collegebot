import { OpenAI } from 'openai';
import { findCompleteTagContent } from '../utils/helpers.js';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { settingsService } from './settings.js';

interface Message {
  role: 'user' | 'assistant' | 'answer' | 'question';
  content: string;
}

interface ResearchTask {
  type: 'college' | 'scholarship';
  name: string;
  findings: Array<{
    detail: string;
    category: 'deadline' | 'requirement' | 'contact' | 'financial' | 'other';
    confidence: 'high' | 'medium' | 'low';
    source?: string;
  }>;
}

export class OpenAIService {
  private client: OpenAI;
  private userId?: string;
  private responseIds: Map<string, string> = new Map(); // To track conversation state

  constructor(apiKey: string, userId?: string) {
    this.client = new OpenAI({
      apiKey
    });
    this.userId = userId;
  }

  private extractResearchTasks(content: string): ResearchTask[] {
    const tasks: ResearchTask[] = [];
    const taskRegex = /\[RESEARCH_TASK\]\s*({[\s\S]*?})\s*\[\/RESEARCH_TASK\]/g;
    let match;

    while ((match = taskRegex.exec(content)) !== null) {
      try {
        const taskJson = match[1];
        const task = JSON.parse(taskJson);
        if (this.isValidResearchTask(task)) {
          tasks.push(task);
        }
      } catch (error) {
        console.error('Error parsing research task:', error);
      }
    }

    return tasks;
  }

  private isValidResearchTask(task: any): task is ResearchTask {
    return (
      task &&
      typeof task === 'object' &&
      (task.type === 'college' || task.type === 'scholarship') &&
      typeof task.name === 'string' &&
      Array.isArray(task.findings) &&
      task.findings.every((finding: any) =>
        finding &&
        typeof finding.detail === 'string' &&
        ['deadline', 'requirement', 'contact', 'financial', 'other'].includes(finding.category) &&
        ['high', 'medium', 'low'].includes(finding.confidence) &&
        (finding.source === undefined || typeof finding.source === 'string')
      )
    );
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;
    let conversationId = '';

    while (continueProcessing) {
      console.info('Processing message with current state', {
        messageCount: messages.length,
        continueProcessing
      });

      const result = await this.processSingleStream(messages, systemPrompt, sendSSE, conversationId);
      messages = result.messages;
      continueProcessing = result.continueProcessing;
      
      // Store the response ID for continuing the conversation
      if (result.responseId) {
        conversationId = result.responseId;
      }
    }

    return messages;
  }

  async processSingleStream(
    messages: Message[], 
    systemPrompt: string, 
    sendSSE: (data: any) => void,
    previousResponseId?: string
  ) {
    console.info('Starting OpenAI stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let savedAnswer: string | null = null;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message
    let isFirstAnswer = messages.filter(msg => msg.role === 'assistant').length === 0;
    let researchTasks: ResearchTask[] = [];
    let responseId = '';

    try {
      // Format the input for OpenAI Responses API
      const lastMessage = messages[messages.length - 1];
      
      // Prepare the request options
      const requestOptions: any = {
        model: await settingsService.getCurrentModel(),
        input: lastMessage.content,
        temperature: 0
      };
      
      // If we have a previous response ID, use it to continue the conversation
      if (previousResponseId) {
        requestOptions.previous_response_id = previousResponseId;
      }
      
      // If this is the first message, include the system prompt
      if (messages.length === 1) {
        // If this is the first answer, append a request for a title
        if (isFirstAnswer) {
          systemPrompt += '\n\nAfter providing your answer, suggest a brief, descriptive title for this chat based on the discussion. Format it as: <title>Your suggested title</title>';
        }
        
        // For the first message, we'll include the system prompt in the input
        requestOptions.input = `${systemPrompt}\n\n${lastMessage.content}`;
      }

      console.info('System prompt', {
        preview: systemPrompt.slice(0, 200),
        totalLength: systemPrompt.length
      });

      // Call the OpenAI Responses API
      const response = await this.client.responses.create(requestOptions);
      responseId = response.id;
      
      // Process the response
      if (response.output && response.output.length > 0) {
        for (const output of response.output) {
          if (output.type === 'message' && output.content) {
            for (const content of output.content) {
              if (content.type === 'output_text') {
                const text = content.text;
                rawMessage += text;
                toolBuffer += text;
                
                // Check for complete tool call first
                const { found, toolResult } = detectToolCall(toolBuffer);
                if (found && toolResult) {
                  console.info('Found complete tool call', { toolCall: toolResult.fullMatch });
                  
                  // Process the tool call using the shared utility
                  const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId);
                  
                  // Return the result with the response ID
                  return { ...result, responseId };
                }

                // Process other tags in the buffer
                const processTag = (tagName: string, type: string) => {
                  let result;
                  while ((result = findCompleteTagContent(tagName, toolBuffer))) {
                    if (tagName === 'answer') {
                      savedAnswer = result.content;
                      messages.push({
                        role: 'answer',
                        content: result.content
                      });
                      // Extract research tasks from the answer
                      researchTasks = this.extractResearchTasks(result.content);
                      // Only send the SSE if we haven't seen a title tag yet
                      if (!isFirstAnswer) {
                        sendSSE({ 
                          type: 'response', 
                          content: result.content,
                          researchTasks
                        });
                      }
                    } else if (tagName === 'title' && isFirstAnswer) {
                      // When we get the title, send both the saved answer and title together
                      sendSSE({
                        type: 'response',
                        content: savedAnswer,
                        suggestedTitle: result.content.trim(),
                        researchTasks
                      });
                      isFirstAnswer = false; // Mark that we've handled the first answer
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
              }
            }
          }
        }
      }

      // Process any remaining content
      if (toolBuffer.trim() || messageContent.trim()) {
        // Check for complete tool calls
        const toolCallMatches: [string, string][] = [];
        let toolResult;
        while ((toolResult = findCompleteTagContent('tool', toolBuffer))) {
          toolCallMatches.push([toolResult.fullMatch, toolResult.content]);
          toolBuffer = toolBuffer.replace(toolResult.fullMatch, '');
        }

        // Process any complete tool calls
        if (toolCallMatches.length > 0) {
          hasToolCalls = true;
          
          for (const [toolCall, toolContent] of toolCallMatches) {
            console.info('Processing tool call', { toolCall });
            
            // Process the tool call using the shared utility
            const result = await executeToolCall(toolContent, messages, sendSSE, this.userId);
            
            // Update messages and flags
            messages = result.messages;
            hasToolCalls = result.hasToolCalls;
            continueProcessing = result.continueProcessing;
            
            // Remove processed tool call from buffer and any whitespace
            toolBuffer = toolBuffer.replace(toolCall, '').trim();
          }
        }

        // Check for any remaining tool calls
        const remainingToolCalls = toolBuffer.match(/<tool>[\s\S]*?<\/tool>/g);

        // If we have tool calls, process them and continue
        if (remainingToolCalls || toolCallMatches.length > 0) {
          continueProcessing = true;
          hasToolCalls = !!remainingToolCalls;
          return { hasToolCalls, messages, continueProcessing, responseId };
        }

        // No tool calls, check for remaining content
        const remainingContent = toolBuffer.trim();
        if (!savedAnswer && remainingContent) {
          messages.push({
            role: 'question',
            content: remainingContent
          });
          sendSSE({ 
            type: 'response', 
            content: remainingContent
          });
        }
      }

      // No more processing needed
      continueProcessing = false;
      hasToolCalls = false;
      return { hasToolCalls, messages, continueProcessing, responseId };
    } catch (error: any) {
      console.error('Error in stream processing', error);
      sendSSE({ type: 'error', content: error.message });
      throw error;
    }
  }

  async analyzeChatHistory(chat: any, systemPrompt: string, sendSSE: (data: any) => void) {
    try {
      // Extract and format chat messages for readability
      const chatContent = chat.messages
        .filter((msg: any) => msg.content && msg.content.trim())
        .map((msg: any) => `${msg.role.toUpperCase()}: ${msg.content.trim()}`)
        .join('\n\n');
      
      // Create a new message array with just a single user message
      const messages: Message[] = [
        {
          role: 'user' as const,
          content: `Please analyze the following chat history and extract relevant information according to the instructions. 
          
Chat Title: ${chat.title || 'Untitled Chat'}
Chat ID: ${chat.id}
Created At: ${chat.createdAt}

CHAT HISTORY:
${chatContent}

Based on this chat history, identify all colleges and scholarships mentioned that should be added to the student's map. For each one, you'll need to:
1. Use the geocode tool to get coordinates
2. Then use the create_map_location tool to add it to the map
3. Move on to the next location

DO NOT try to geocode the same location multiple times. After you've added a location to the map, move on to the next location.

Now, please process this information and extract all relevant data according to the system instructions.`
        }
      ];

      console.info('Starting fresh conversation with chat history as reference data');
      
      // Important: Use the returned messages from processStream to keep state
      const updatedMessages = await this.processStream(messages, systemPrompt, sendSSE);
      console.info('Finished processing chat history:', { 
        messageCount: updatedMessages.length,
        lastMessageRole: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].role : 'none'
      });
      
      return updatedMessages;
    } catch (error) {
      console.error('Error in analyzeChatHistory:', error);
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
