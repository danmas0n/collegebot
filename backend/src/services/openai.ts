import { OpenAI } from 'openai';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { logger } from '../utils/logger.js';
import { flowCostTracker } from './flow-cost-tracker.js';
import { costCalculator } from './cost-calculator.js';

export class OpenAIService {
  private client: OpenAI;
  private userId?: string;
  private responseIds: Map<string, string> = new Map(); // To track conversation state
  private responseProcessor: ResponseProcessor;
  private stepCounter: number = 0;
  private readonly MAX_STEPS = 50;
  private currentChatId?: string;
  private currentStage?: 'recommendations' | 'map' | 'plan' | 'research' | 'other';

  constructor(apiKey: string, userId?: string) {
    this.client = new OpenAI({
      apiKey
    });
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
        provider: 'openai',
        model,
        usage: {
          inputTokens,
          outputTokens,
          cacheCreationTokens: 0, // OpenAI doesn't have cache tokens
          cacheReadTokens: 0
        },
        requestSequence: this.stepCounter
      });

      logger.info('OpenAI: Tracked request cost', {
        chatId: this.currentChatId,
        stage: this.currentStage,
        model,
        inputTokens,
        outputTokens,
        requestSequence: this.stepCounter
      });
    } catch (error) {
      logger.error('OpenAI: Error tracking request cost', { error, chatId: this.currentChatId });
    }
  }

  async processStream(initialMessages: Message[], systemPrompt: string, sendSSE: (data: any) => void) {
    let messages = [...initialMessages];
    let continueProcessing = true;
    let conversationId = '';

    // Reset processor and step counter for new conversation
    this.responseProcessor.reset();
    this.stepCounter = 0;

    try {
      while (continueProcessing && this.stepCounter < this.MAX_STEPS) {
        this.stepCounter++;
        
        logger.info('OpenAI: Processing message with current state', {
          messageCount: messages.length,
          continueProcessing,
          stepCounter: this.stepCounter,
          maxSteps: this.MAX_STEPS
        });

        // Check circuit breaker before processing
        if (this.stepCounter >= this.MAX_STEPS) {
          console.warn('OpenAI: Circuit breaker activated: Maximum steps reached', {
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
          const result = await this.processSingleStream(messages, systemPrompt, sendSSE, conversationId);
          messages = result.messages;
          break; // Force exit
        }

        const result = await this.processSingleStream(messages, systemPrompt, sendSSE, conversationId);
        messages = result.messages;
        continueProcessing = result.continueProcessing;
        
        // Store the response ID for continuing the conversation
        if (result.responseId) {
          conversationId = result.responseId;
        }
      }

      // Complete the flow when processing is finished
      if (this.currentChatId) {
        try {
          await flowCostTracker.completeFlow(this.currentChatId);
          logger.info('OpenAI: Flow completed', { chatId: this.currentChatId, totalSteps: this.stepCounter });
        } catch (error) {
          logger.error('OpenAI: Error completing flow', { error, chatId: this.currentChatId });
        }
      }

      // Send complete event when processing is finished
      logger.info('OpenAI processing complete, sending complete event');
      sendSSE({ type: 'complete' });
      
      return messages;
    } catch (error) {
      logger.error('Error in processStream:', error);
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      sendSSE({ type: 'complete' });
      throw error;
    }
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
    let hasProcessedContent = false; // Track if any content was processed during streaming

    try {
      // Consolidate messages into proper conversation structure
      const consolidatedMessages = this.responseProcessor.consolidateMessages(messages);
      
      // Format the input for OpenAI Responses API
      const lastMessage = consolidatedMessages[consolidatedMessages.length - 1];
      
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
      if (consolidatedMessages.length === 1) {
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
      
      // Track cost if we have chat context and usage data
      if (this.currentChatId && this.currentStage && response.usage) {
        try {
          // OpenAI Responses API usage structure may be different, let's handle it safely
          const usage = response.usage as any;
          const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
          const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
          await this.trackRequestCost(inputTokens, outputTokens, requestOptions.model);
        } catch (error) {
          logger.error('OpenAI: Error tracking request cost', { error, chatId: this.currentChatId });
        }
      }
      
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
                
                // Track if any content was processed
                if (processingResult.hasContent) {
                  hasProcessedContent = true;
                }

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

      // Process any remaining content at response end
      logger.info('OpenAI: Message complete', { 
        hasContent: !!(toolBuffer.trim() || messageContent.trim()),
        hasProcessedContent,
        hasSavedAnswer: !!this.responseProcessor.getSavedAnswer()
      });
      
      // Log complete raw message before processing
      logger.info('OpenAI: Complete raw message', { message: rawMessage });
       
      // FIXED: Check if we processed content during streaming OR have remaining content
      // Don't skip processing if we have a saved answer from the response processor
      if (!toolBuffer.trim() && !messageContent.trim() && !hasProcessedContent && !this.responseProcessor.getSavedAnswer()) {
        logger.info('OpenAI: No content received and no content processed, skipping processing');
        return { hasToolCalls, messages, continueProcessing: false, responseId };
      }

      // If we have a saved answer but no remaining content, we're done
      if (this.responseProcessor.getSavedAnswer() && !toolBuffer.trim() && !messageContent.trim()) {
        logger.info('OpenAI: Message processing complete with saved answer');
        continueProcessing = false;
        hasToolCalls = false;
        return { hasToolCalls, messages, continueProcessing, responseId };
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
      logger.info('OpenAI: Found tool calls', { count: toolCallMatches.length });

      // Process any complete tool calls
      if (toolCallMatches.length > 0) {
        logger.info('OpenAI: Processing complete tool calls');
        hasToolCalls = true;
        
        for (const [toolCall, toolContent] of toolCallMatches) {
          logger.info('OpenAI: Processing tool call', { toolCall });
          
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
        logger.info('OpenAI: Message analysis', {
          remainingToolCalls: remainingToolCalls?.length || 0,
          toolCallMatches: toolCallMatches.length,
          hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer()
        });
        continueProcessing = true;
        hasToolCalls = !!remainingToolCalls;
        return { hasToolCalls, messages, continueProcessing, responseId };
      }

      // CRITICAL FIX: Handle untagged content
      // If we have content without answer tags and no tool calls,
      // treat the content as the final answer instead of continuing to process
      const remainingContent = toolBuffer.trim();
      if (remainingContent && !this.responseProcessor.getSavedAnswer()) {
        logger.info('OpenAI: Completed with untagged content, treating as answer', {
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
        return { hasToolCalls, messages, continueProcessing, responseId };
      }

      // Handle any remaining content using the processor (fallback for other cases)
      const remainingResult = this.responseProcessor.handleRemainingContent(toolBuffer, messages, sendSSE);
      messages = remainingResult.messages;

      // No more processing needed
      logger.info('OpenAI: Message analysis', {
        remainingToolCalls: 0,
        hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer(),
        continueProcessing: false,
        hasToolCalls: false
      });
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
