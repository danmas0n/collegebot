import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { logger } from '../utils/logger.js';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private userId?: string;
  private responseProcessor: ResponseProcessor;

  constructor(apiKey: string, userId?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.userId = userId;
    this.responseProcessor = new ResponseProcessor();
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;

    // Reset processor for new conversation
    this.responseProcessor.reset();

    while (continueProcessing) {
      logger.info('Gemini: Processing message with current state', {
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
    logger.info('Starting Gemini stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message

    try {
      // Map our roles to Gemini's roles
      const geminiMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      logger.debug('Gemini: System prompt', {
        preview: systemPrompt.slice(0, 200),
        totalLength: systemPrompt.length
      });

      const model = await settingsService.getCurrentModel();
      const generativeModel = this.client.getGenerativeModel({ model });

      const chat = generativeModel.startChat({
        history: geminiMessages,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0
        }
      });

      const result = await chat.sendMessageStream(systemPrompt);
      let streamController = new AbortController();

      for await (const chunk of result.stream) {
        const text = chunk.text();
        toolBuffer += text;
        rawMessage += text;

        // Check for complete tool call first - if found, terminate the stream
        const { found, toolResult } = detectToolCall(toolBuffer);
        if (found && toolResult) {
          logger.info('Gemini: Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
          
          // Cancel the stream - Gemini doesn't have a direct abort method, but we can break out of the loop
          streamController.abort();
          
          // Process the tool call using the shared utility
          const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId);
          
          // Return the result
          return result;
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
        
        // Check if we've been aborted
        if (streamController.signal.aborted) {
          break;
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
            logger.info('Gemini: Processing tool call', { toolCallPreview: toolCall.substring(0, 100) });
            
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
          return { hasToolCalls, messages, continueProcessing };
        }

        // Handle any remaining content using the processor
        const remainingResult = this.responseProcessor.handleRemainingContent(toolBuffer, messages, sendSSE);
        messages = remainingResult.messages;
      }

      // No more processing needed
      continueProcessing = false;
      hasToolCalls = false;
      return { hasToolCalls, messages, continueProcessing };
    } catch (error: any) {
      logger.error('Gemini: Error in stream processing', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
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

      logger.info('Gemini: Continuing conversation with proper chat history');
      
      // Important: Use the returned messages from processStream to keep state
      const updatedMessages = await this.processStream(chatMessages, systemPrompt, sendSSE);
      logger.info('Gemini: Finished processing chat history', { 
        messageCount: updatedMessages.length,
        lastMessageRole: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].role : 'none'
      });
      
      return updatedMessages;
    } catch (error) {
      logger.error('Gemini: Error in analyzeChatHistory', { error: error instanceof Error ? error.message : String(error) });
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
