import { OpenAI } from 'openai';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { logger } from '../utils/logger.js';

export class OpenAIService {
  private client: OpenAI;
  private userId?: string;
  private responseIds: Map<string, string> = new Map(); // To track conversation state
  private responseProcessor: ResponseProcessor;

  constructor(apiKey: string, userId?: string) {
    this.client = new OpenAI({
      apiKey
    });
    this.userId = userId;
    this.responseProcessor = new ResponseProcessor();
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;
    let conversationId = '';

    // Reset processor for new conversation
    this.responseProcessor.reset();

    while (continueProcessing) {
      logger.info('OpenAI: Processing message with current state', {
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
    logger.info('Starting OpenAI stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message
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
        // For the first message, we'll include the system prompt in the input
        requestOptions.input = `${systemPrompt}\n\n${lastMessage.content}`;
      }

      logger.debug('OpenAI: System prompt', {
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
                  logger.info('OpenAI: Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
                  
                  // Process the tool call using the shared utility
                  const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId);
                  
                  // Return the result with the response ID
                  return { ...result, responseId };
                }

                // Process XML tags using the shared processor
                const processingResult = this.responseProcessor.processXmlTags(toolBuffer, messages, sendSSE);
                toolBuffer = processingResult.updatedBuffer;
                messages = processingResult.messages;

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
        while ((toolResult = detectToolCall(toolBuffer))) {
          if (toolResult.toolResult) {
            toolCallMatches.push([toolResult.toolResult.fullMatch, toolResult.toolResult.content]);
            toolBuffer = toolBuffer.replace(toolResult.toolResult.fullMatch, '');
          }
        }

        // Process any complete tool calls
        if (toolCallMatches.length > 0) {
          hasToolCalls = true;
          
          for (const [toolCall, toolContent] of toolCallMatches) {
            logger.info('OpenAI: Processing tool call', { toolCallPreview: toolCall.substring(0, 100) });
            
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

        // Handle any remaining content using the processor
        const remainingResult = this.responseProcessor.handleRemainingContent(toolBuffer, messages, sendSSE);
        messages = remainingResult.messages;
      }

      // No more processing needed
      continueProcessing = false;
      hasToolCalls = false;
      return { hasToolCalls, messages, continueProcessing, responseId };
    } catch (error: any) {
      logger.error('OpenAI: Error in stream processing', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      sendSSE({ type: 'error', content: error.message });
      throw error;
    }
  }

  async analyzeChatHistory(chat: any, systemPrompt: string, sendSSE: (data: any) => void) {
    try {
      // Convert chat history to proper message format and continue the conversation
      const chatMessages: Message[] = chat.messages
        .filter((msg: any) => msg.content && msg.content.trim())
        .map((msg: any) => ({
          role: msg.role as Message['role'],
          content: msg.content.trim()
        }));
      
      // Add the analysis request as a new user message
      chatMessages.push({
        role: 'user',
        content: `Based on our conversation above, please extract all colleges and scholarships mentioned that should be added to the student's map. For each one, you'll need to:
1. Use the geocode tool to get coordinates
2. Then use the create_map_location tool to add it to the map
3. Move on to the next location

DO NOT try to geocode the same location multiple times. After you've added a location to the map, move on to the next location.

Now, please process this information and extract all relevant data according to the system instructions.`
      });

      logger.info('OpenAI: Continuing conversation with proper chat history');
      
      // Important: Use the returned messages from processStream to keep state
      const updatedMessages = await this.processStream(chatMessages, systemPrompt, sendSSE);
      logger.info('OpenAI: Finished processing chat history', { 
        messageCount: updatedMessages.length,
        lastMessageRole: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].role : 'none'
      });
      
      return updatedMessages;
    } catch (error) {
      logger.error('OpenAI: Error in analyzeChatHistory', { error: error instanceof Error ? error.message : String(error) });
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
