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

    try {
      while (continueProcessing) {
        console.info('Processing message with current state', {
          messageCount: messages.length,
          continueProcessing
        });

        const result = await this.processSingleStream(messages, systemPrompt, sendSSE);
        messages = result.messages;
        continueProcessing = result.continueProcessing;
      }

      // Send complete event when processing is finished
      console.info('Gemini processing complete, sending complete event');
      sendSSE({ type: 'complete' });
      
      return messages;
    } catch (error) {
      console.error('Error in processStream:', error);
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      sendSSE({ type: 'complete' });
      throw error;
    }
  }

  async processSingleStream(messages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    logger.info('Starting Gemini stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message
    let hasProcessedContent = false; // Track if any content was processed during streaming

    try {
      // Consolidate messages into proper conversation structure
      const consolidatedMessages = this.responseProcessor.consolidateMessages(messages);
      
      // Map our roles to Gemini's roles
      const geminiMessages = consolidatedMessages.map(msg => ({
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
        
        // Track if any content was processed
        if (processingResult.hasContent) {
          hasProcessedContent = true;
        }

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

      // Process any remaining content at stream end
      logger.info('Gemini: Message complete', { 
        hasContent: !!(toolBuffer.trim() || messageContent.trim()),
        hasProcessedContent,
        hasSavedAnswer: !!this.responseProcessor.getSavedAnswer()
      });
      
      // Log complete raw message before processing
      logger.info('Gemini: Complete raw message', { message: rawMessage });
       
      // FIXED: Check if we processed content during streaming OR have remaining content
      // Don't skip processing if we have a saved answer from the response processor
      if (!toolBuffer.trim() && !messageContent.trim() && !hasProcessedContent && !this.responseProcessor.getSavedAnswer()) {
        logger.info('Gemini: No content received and no content processed, skipping processing');
        return { hasToolCalls, messages, continueProcessing: false };
      }

      // If we have a saved answer but no remaining content, we're done
      if (this.responseProcessor.getSavedAnswer() && !toolBuffer.trim() && !messageContent.trim()) {
        logger.info('Gemini: Message processing complete with saved answer');
        continueProcessing = false;
        hasToolCalls = false;
        return { hasToolCalls, messages, continueProcessing };
      }

      // Combine remaining content to check for tags
      const combinedContent = toolBuffer + messageContent;
      toolBuffer = combinedContent;
      messageContent = '';

      // Check for complete tool calls
      const toolCallMatches: [string, string][] = [];
      let toolResult;
      while ((toolResult = detectToolCall(toolBuffer))) {
        if (toolResult.toolResult) {
          toolCallMatches.push([toolResult.toolResult.fullMatch, toolResult.toolResult.content]);
          toolBuffer = toolBuffer.replace(toolResult.toolResult.fullMatch, '');
        }
      }
      logger.info('Gemini: Found tool calls', { count: toolCallMatches.length });

      // Process any complete tool calls
      if (toolCallMatches.length > 0) {
        logger.info('Gemini: Processing complete tool calls');
        hasToolCalls = true;
        
        for (const [toolCall, toolContent] of toolCallMatches) {
          logger.info('Gemini: Processing tool call', { toolCall });
          
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
        logger.info('Gemini: Message analysis', {
          remainingToolCalls: remainingToolCalls?.length || 0,
          toolCallMatches: toolCallMatches.length,
          hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer()
        });
        continueProcessing = true;
        hasToolCalls = !!remainingToolCalls;
        return { hasToolCalls, messages, continueProcessing };
      }

      // CRITICAL FIX: Handle untagged content
      // If we have content without answer tags and no tool calls,
      // treat the content as the final answer instead of continuing to process
      const remainingContent = toolBuffer.trim();
      if (remainingContent && !this.responseProcessor.getSavedAnswer()) {
        logger.info('Gemini: Completed with untagged content, treating as answer', {
          contentLength: remainingContent.length,
          contentPreview: remainingContent.substring(0, 100)
        });
        
        // Treat the remaining content as the answer
        messages.push({
          role: 'answer',
          content: remainingContent
        });
        
        sendSSE({ 
          type: 'response', 
          content: remainingContent
        });
        
        // Terminate processing
        continueProcessing = false;
        hasToolCalls = false;
        return { hasToolCalls, messages, continueProcessing };
      }

      // Handle any remaining content using the processor (fallback for other cases)
      const remainingResult = this.responseProcessor.handleRemainingContent(toolBuffer, messages, sendSSE);
      messages = remainingResult.messages;

      // No more processing needed
      logger.info('Gemini: Message analysis', {
        remainingToolCalls: 0,
        hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer(),
        continueProcessing: false,
        hasToolCalls: false
      });
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
      const analysisPrompt = `Based on our conversation above, please extract all colleges and scholarships mentioned that should be added to the student's map. For each one, you'll need to:
1. Use the geocode tool to get coordinates
2. Then use the create_map_location tool to add it to the map
3. Move on to the next location

IMPORTANT: 
- DO NOT create duplicate locations. Before adding any location, check if it already exists on the map.
- DO NOT try to geocode the same location multiple times. After you've added a location to the map, move on to the next location.
- When creating map locations, use the chat ID "${chat.id}" in the sourceChats array to link this location back to this conversation.

Now, please process this information and extract all relevant data according to the system instructions.`;

      chatMessages.push({
        role: 'user',
        content: analysisPrompt
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
