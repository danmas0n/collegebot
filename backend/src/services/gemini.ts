import { GoogleGenerativeAI } from '@google/generative-ai';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { logger } from '../utils/logger.js';
import { flowCostTracker } from './flow-cost-tracker.js';
import { costCalculator } from './cost-calculator.js';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private userId?: string;
  private responseProcessor: ResponseProcessor;
  private stepCounter: number = 0;
  private readonly MAX_STEPS = 150;
  private currentChatId?: string;
  private currentStage?: 'recommendations' | 'map' | 'plan' | 'research' | 'other';

  constructor(apiKey: string, userId?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.userId = userId;
    this.responseProcessor = new ResponseProcessor();
  }

  /**
   * Set the current chat context for cost tracking
   */
  setChatContext(chatId: string, stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other') {
    this.currentChatId = chatId;
    this.currentStage = stage;
  }

  /**
   * Set the student context for proper cost tracking
   */
  setStudentContext(studentId: string) {
    // For now, we'll store the studentId but the cost tracking still uses userId
    // This is a placeholder for future enhancement where we properly separate user and student tracking
    // The current implementation in trackRequestCost uses userId as studentId
  }

  /**
   * Track request cost for the current chat flow
   */
  private async trackRequestCost(inputTokens: number, outputTokens: number, model: string): Promise<void> {
    if (!this.currentChatId || !this.currentStage || !this.userId) {
      return;
    }

    try {
      // Start flow if not already active
      if (!flowCostTracker.isFlowActive(this.currentChatId)) {
        // We need studentId - for now we'll use userId as studentId
        // In a real implementation, you'd get the actual studentId from the chat context
        await flowCostTracker.startFlow(
          this.currentChatId,
          this.userId, // Using userId as studentId for now
          this.userId,
          this.currentStage
        );
      }

      // Add this request to the flow
      await flowCostTracker.addRequestToFlow(this.currentChatId, {
        provider: 'gemini',
        model,
        usage: {
          inputTokens,
          outputTokens,
          cacheCreationTokens: 0, // Gemini doesn't have cache tokens
          cacheReadTokens: 0
        },
        requestSequence: this.stepCounter
      });

      logger.info('Gemini: Tracked request cost', {
        chatId: this.currentChatId,
        stage: this.currentStage,
        model,
        inputTokens,
        outputTokens,
        requestSequence: this.stepCounter
      });
    } catch (error) {
      logger.error('Gemini: Error tracking request cost', { error, chatId: this.currentChatId });
    }
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;

    // Reset processor and step counter for new conversation
    this.responseProcessor.reset();
    this.stepCounter = 0;

    try {
      while (continueProcessing && this.stepCounter < this.MAX_STEPS) {
        this.stepCounter++;
        
        console.info('Gemini: Processing message with current state', {
          messageCount: messages.length,
          continueProcessing,
          stepCounter: this.stepCounter,
          maxSteps: this.MAX_STEPS
        });

        // Check circuit breaker before processing
        if (this.stepCounter >= this.MAX_STEPS) {
          console.warn('Gemini: Circuit breaker activated: Maximum steps reached', {
            stepCounter: this.stepCounter,
            maxSteps: this.MAX_STEPS
          });
          
          // Inject circuit breaker message
          messages.push({
            role: 'user',
            content: 'You have reached the maximum number of processing steps (50). Please stop thinking and provide your final answer now.'
          });
          
          sendSSE({ 
            type: 'system', 
            content: `🔄 Circuit breaker activated: Forcing final answer after ${this.MAX_STEPS} steps to prevent runaway loops` 
          });
          
          // Process one final time with the circuit breaker message
          const result = await this.processSingleStream(messages, systemPrompt, sendSSE);
          messages = result.messages;
          break; // Force exit
        }

        const result = await this.processSingleStream(messages, systemPrompt, sendSSE);
        messages = result.messages;
        continueProcessing = result.continueProcessing;
      }

      // Complete the flow when processing is finished
      if (this.currentChatId) {
        try {
          await flowCostTracker.completeFlow(this.currentChatId);
          logger.info('Gemini: Flow completed', { chatId: this.currentChatId, totalSteps: this.stepCounter });
        } catch (error) {
          logger.error('Gemini: Error completing flow', { error, chatId: this.currentChatId });
        }
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
          maxOutputTokens: 16384,
          temperature: 0
        }
      });

      const result = await chat.sendMessageStream(systemPrompt);
      let streamController = new AbortController();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        toolBuffer += text;
        rawMessage += text;

        // Track token usage if available
        if (chunk.usageMetadata) {
          totalInputTokens = chunk.usageMetadata.promptTokenCount || 0;
          totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }

        // Check for complete tool call first - if found, terminate the stream
        const { found, toolResult } = detectToolCall(toolBuffer);
        if (found && toolResult) {
          logger.info('Gemini: Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
          
          // Cancel the stream - Gemini doesn't have a direct abort method, but we can break out of the loop
          streamController.abort();
          
          // Process the tool call using the shared utility
          const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId, this.currentChatId);
          
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

      // Track cost if we have chat context and usage data
      if (this.currentChatId && this.currentStage && (totalInputTokens > 0 || totalOutputTokens > 0)) {
        try {
          await this.trackRequestCost(totalInputTokens, totalOutputTokens, model);
        } catch (error) {
          logger.error('Gemini: Error tracking request cost', { error, chatId: this.currentChatId });
        }
      }

      // Process any remaining content at stream end
      logger.info('Gemini: Message complete', { 
        hasContent: !!(toolBuffer.trim() || messageContent.trim()),
        hasProcessedContent,
        hasSavedAnswer: !!this.responseProcessor.getSavedAnswer(),
        tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
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
          const result = await executeToolCall(toolContent, messages, sendSSE, this.userId, this.currentChatId);
          
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

      // If we have remaining tool calls that weren't processed, continue
      if (remainingToolCalls) {
        logger.info('Gemini: Message analysis - remaining tool calls to process', {
          remainingToolCalls: remainingToolCalls.length,
          hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer()
        });
        continueProcessing = true;
        hasToolCalls = true;
        return { hasToolCalls, messages, continueProcessing };
      }

      // If we processed tool calls but also have a complete answer, we're done
      if (toolCallMatches.length > 0 && this.responseProcessor.getSavedAnswer()) {
        logger.info('Gemini: Message analysis - tool calls processed and answer received, stopping', {
          toolCallMatches: toolCallMatches.length,
          hasCompleteAnswer: true
        });
        continueProcessing = false;
        hasToolCalls = false;
        return { hasToolCalls, messages, continueProcessing };
      }

      // If we processed tool calls but no answer yet, continue for more processing
      if (toolCallMatches.length > 0) {
        logger.info('Gemini: Message analysis - tool calls processed, continuing for answer', {
          toolCallMatches: toolCallMatches.length,
          hasCompleteAnswer: false
        });
        continueProcessing = true;
        hasToolCalls = false;
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
