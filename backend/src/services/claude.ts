import { Anthropic } from '@anthropic-ai/sdk';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { logger } from '../utils/logger.js';
import { flowCostTracker } from './flow-cost-tracker.js';
import { costCalculator } from './cost-calculator.js';

// Timeout constants - per individual Claude API call, not entire process
const CLAUDE_API_TIMEOUT = 180000; // 3 minutes per individual Claude API call
const TOOL_EXECUTION_TIMEOUT = 30000; // 30 seconds per tool execution

interface CacheControl {
  type: 'ephemeral';
}

interface ContentBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
};

interface CacheUsage {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens: number;
  output_tokens: number;
}

export class ClaudeService {
  private client: Anthropic;
  private userId?: string;
  private responseProcessor: ResponseProcessor;
  private stepCounter: number = 0;
  private readonly MAX_STEPS = 50;
  private currentChatId?: string;
  private currentStage?: 'recommendations' | 'map' | 'plan' | 'research' | 'other';
  private currentUsage?: CacheUsage; // Track usage for current request
  private cumulativeInputTokens: number = 0; // Track cumulative input tokens for cache calculation

  constructor(apiKey: string, userId?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com'
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
    
    // Reset cumulative input tokens for new chat/flow
    this.cumulativeInputTokens = 0;
    
    logger.info('Claude: Chat context set, reset cumulative input tokens', {
      chatId,
      stage,
      cumulativeInputTokens: this.cumulativeInputTokens
    });
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
  private async trackRequestCost(usage: CacheUsage, model: string): Promise<void> {
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
        provider: 'claude',
        model,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheCreationTokens: usage.cache_creation_input_tokens,
          cacheReadTokens: usage.cache_read_input_tokens
        },
        requestSequence: this.stepCounter
      });

      // Cost tracking logged in flow-cost-tracker.ts, no need to duplicate here
    } catch (error) {
      logger.error('Claude: Error tracking request cost', { error, chatId: this.currentChatId });
    }
  }

  /**
   * Convert a system prompt to cache-enabled format with cache breakpoints
   */
  private createCachedSystemMessage(systemPrompt: string): ContentBlock[] {
    // For now, we'll cache the entire system prompt as one block
    // In the future, we can split this into multiple cache breakpoints
    return [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  /**
   * Apply incremental caching to messages by marking ONLY the last user message with cache control
   * This enables Claude to cache conversation history for multi-turn conversations
   */
  private applyIncrementalCaching(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length === 0) return messages;

    // First, remove cache control from all messages
    messages.forEach(message => {
      if (typeof message.content !== 'string') {
        const contentBlocks = message.content as ContentBlock[];
        contentBlocks.forEach(block => {
          delete block.cache_control;
        });
      }
    });

    // Find the last user message and mark it for caching
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        // Convert string content to ContentBlock array if needed
        if (typeof messages[i].content === 'string') {
          messages[i].content = [
            {
              type: 'text',
              text: messages[i].content as string,
              cache_control: { type: 'ephemeral' }
            }
          ];
        } else {
          // If already ContentBlock array, mark the last block for caching
          const contentBlocks = messages[i].content as ContentBlock[];
          if (contentBlocks.length > 0) {
            contentBlocks[contentBlocks.length - 1].cache_control = { type: 'ephemeral' };
          }
        }
        break;
      }
    }

    return messages;
  }

  /**
   * Log token usage only (simplified)
   */
  private logTokenUsage(usage: any, model: string) {
    if (usage) {
      logger.info('Claude: Token Usage', {
        model,
        tokens: {
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          cache_creation: usage.cache_creation_input_tokens || 0,
          cache_read: usage.cache_read_input_tokens || 0,
          total: (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
        }
      });
    }
  }

  /**
   * Wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Test caching functionality with a simple prompt
   */
  async testCaching(): Promise<void> {
    console.info('Testing Claude prompt caching...');
    
    const testPrompt = `You are a helpful AI assistant. This is a test prompt to verify that caching is working correctly. 
    
Please respond with a simple message confirming that you received this prompt. Keep your response brief.`;
    
    const testMessage: Message = {
      role: 'user',
      content: 'Hello, please confirm you received the test prompt.'
    };

    try {
      // First call - should create cache
      console.info('First call (should create cache):');
      await this.processSingleStream([testMessage], testPrompt, (data) => {
        console.info('SSE:', data.type, data.content?.substring(0, 100));
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second call - should hit cache
      console.info('Second call (should hit cache):');
      await this.processSingleStream([testMessage], testPrompt, (data) => {
        console.info('SSE:', data.type, data.content?.substring(0, 100));
      });

      console.info('Cache test completed successfully!');
    } catch (error) {
      console.error('Cache test failed:', error);
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
        
        logger.info('Claude: Processing message with current state', {
          messageCount: messages.length,
          continueProcessing,
          stepCounter: this.stepCounter,
          maxSteps: this.MAX_STEPS
        });

        // Check circuit breaker before processing
        if (this.stepCounter >= this.MAX_STEPS) {
          logger.warn('Claude: Circuit breaker activated: Maximum steps reached', {
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
          logger.info('Claude: Flow completed', { chatId: this.currentChatId, totalSteps: this.stepCounter });
        } catch (error) {
          logger.error('Claude: Error completing flow', { error, chatId: this.currentChatId });
        }
      }

      // Send complete event when processing is finished
      console.info('Claude processing complete, sending complete event');
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
    logger.info('Claude: Starting Claude stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message
    let hasProcessedContent = false; // Track if any content was processed during streaming
    let timeoutId: NodeJS.Timeout | null = null; // Declare timeout variable in proper scope

    try {
      // Consolidate messages into proper conversation structure
      const consolidatedMessages = this.responseProcessor.consolidateMessages(messages);
      
      // Map our roles to Claude's roles before sending
      let claudeMessages: AnthropicMessage[] = consolidatedMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Apply incremental caching to conversation history
      claudeMessages = this.applyIncrementalCaching(claudeMessages);

          logger.info('Claude: System prompt', {
            preview: systemPrompt.slice(0, 200),
            totalLength: systemPrompt.length
          });

      const model = await settingsService.getCurrentModel();
      
      // Use cached system message for better performance
      const cachedSystemMessage = this.createCachedSystemMessage(systemPrompt);
      
      const stream = await this.client.messages.stream({
        model,
        max_tokens: 4096,
        messages: claudeMessages,
        system: cachedSystemMessage as any, // Anthropic SDK types may not be up to date with caching
        temperature: 0
      });

      // Set up timeout for the entire stream processing
      timeoutId = setTimeout(() => {
        logger.warn('Claude: Stream timeout reached - stream is taking longer than expected', {
          stepCounter: this.stepCounter,
          currentChatId: this.currentChatId,
          currentStage: this.currentStage,
          messageCount: claudeMessages.length,
          lastMessagePreview: claudeMessages[claudeMessages.length - 1]?.content?.toString().substring(0, 100)
        });
        // Still abort for now, but with more context
        stream.abort();
      }, CLAUDE_API_TIMEOUT);

      for await (const streamEvent of stream) {
        if (streamEvent.type === 'message_start') {
          console.info('Message start');
          toolBuffer = '';
          messageContent = '';
          rawMessage = ''; // Reset raw message buffer
          hasProcessedContent = false; // Reset processed content flag
          
          // Save all usage fields from message_start
          const usage = streamEvent.message.usage as any;
          this.currentUsage = {
            input_tokens: usage.input_tokens || 0,
            output_tokens: usage.output_tokens || 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: usage.cache_read_input_tokens || 0
          };
          
          logger.info('Claude: Usage data saved from message_start', { usage: this.currentUsage });
        }
        else if (streamEvent.type === 'message_delta') {
          // Save all usage fields from message_delta events
          if (this.currentUsage && streamEvent.usage) {
            const usage = streamEvent.usage as any;
            
            // Update all available fields
            if (usage.input_tokens !== undefined) this.currentUsage.input_tokens = usage.input_tokens;
            if (usage.output_tokens !== undefined) this.currentUsage.output_tokens = usage.output_tokens;
            if (usage.cache_creation_input_tokens !== undefined) this.currentUsage.cache_creation_input_tokens = usage.cache_creation_input_tokens;
            if (usage.cache_read_input_tokens !== undefined) this.currentUsage.cache_read_input_tokens = usage.cache_read_input_tokens;
            
            logger.info('Claude: Usage data updated from message_delta', { 
              usage: this.currentUsage,
              deltaUsage: streamEvent.usage
            });
          }
        }
        else if (streamEvent.type === 'content_block_start') {
          console.info('Content block start');
        }
        else if (streamEvent.type === 'content_block_delta' && streamEvent.delta.type === 'text_delta') {
          const text = streamEvent.delta.text;
          toolBuffer += text;
          rawMessage += text; // Accumulate raw message

          // Check for complete tool call - if found, immediately terminate stream
          const { found, toolResult } = detectToolCall(toolBuffer);
          if (found && toolResult) {
            console.info('Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
            
            // Clear timeout before aborting
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            
            // Estimate output tokens from accumulated text since we're aborting mid-stream
            if (this.currentUsage && this.currentChatId && this.currentStage) {
              try {
                // Use word count of accumulated text as proxy for output tokens
                // Rough approximation: 1 token ≈ 0.50 words for English text
                const wordCount = rawMessage.trim().split(/\s+/).length;
                const estimatedOutputTokens = Math.ceil(wordCount / 0.50);
                
                const finalUsage = {
                  input_tokens: this.currentUsage.input_tokens,
                  output_tokens: estimatedOutputTokens,
                  cache_creation_input_tokens: this.currentUsage.cache_creation_input_tokens,
                  cache_read_input_tokens: this.currentUsage.cache_read_input_tokens
                };
                
                logger.info('Claude: Estimating output tokens from accumulated text before tool call', { 
                  rawMessageLength: rawMessage.length,
                  wordCount,
                  estimatedOutputTokens,
                  originalOutputTokens: this.currentUsage.output_tokens,
                  finalUsage
                });
                
                await this.trackRequestCost(finalUsage, model);
              } catch (error) {
                logger.error('Claude: Error tracking cost before tool execution', { error, chatId: this.currentChatId });
              }
            }
            
            // Abort the stream
            stream.abort();
            
            // Process the tool call using the shared utility
            const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId);
            
            // Return the result immediately
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
        }
        else if (streamEvent.type === 'message_stop') {
          console.info('Message complete', { 
            hasContent: !!(toolBuffer.trim() || messageContent.trim()),
            hasProcessedContent,
            hasSavedAnswer: !!this.responseProcessor.getSavedAnswer(),
            finalUsage: this.currentUsage
          });
          
          // Track cost with accumulated usage data
          if (this.currentChatId && this.currentStage && this.currentUsage) {
            try {
              logger.info('Claude: Tracking cost with accumulated usage data', { usage: this.currentUsage });
              await this.trackRequestCost(this.currentUsage, model);
            } catch (error) {
              logger.error('Claude: Error tracking request cost', { error, chatId: this.currentChatId });
            }
          }
          
          // Log complete raw message before processing
          console.info('Complete raw message', { message: rawMessage });
           
          // FIXED: Check if we processed content during streaming OR have remaining content
          // Don't skip processing if we have a saved answer from the response processor
          if (!toolBuffer.trim() && !messageContent.trim() && !hasProcessedContent && !this.responseProcessor.getSavedAnswer()) {
            console.info('No content received and no content processed, skipping processing');
            return { hasToolCalls, messages, continueProcessing: false };
          }

          // If we have a saved answer but no remaining content, we're done
          if (this.responseProcessor.getSavedAnswer() && !toolBuffer.trim() && !messageContent.trim()) {
            console.info('Message processing complete with saved answer');
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
          console.info('Found tool calls', { count: toolCallMatches.length });

          // Process any complete tool calls
          if (toolCallMatches.length > 0) {
            console.info('Processing complete tool calls');
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
            console.info('Message analysis', {
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
            console.info('Claude completed with untagged content, treating as answer', {
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
          console.info('Message analysis', {
            remainingToolCalls: 0,
            hasCompleteAnswer: !!this.responseProcessor.getSavedAnswer(),
            continueProcessing: false,
            hasToolCalls: false
          });
          continueProcessing = false;
          hasToolCalls = false;
        }
        else if ((streamEvent as any).type === 'error') {
          sendSSE({ type: 'error', content: (streamEvent as any).error?.message || 'Unknown error' });
        }
      }

      // Usage data is now properly captured from stream events above
      // No need for the unreliable finalMessage() approach

      // Clear timeout and cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      return { hasToolCalls, messages, continueProcessing };
    } catch (error: any) {
      logger.error('Claude: Error in stream processing', { error: error.message, stack: error.stack });
      sendSSE({ type: 'error', content: error.message });
      throw error;
    } finally {
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Memory cleanup
      toolBuffer = '';
      messageContent = '';
      rawMessage = '';
      
      // Force garbage collection hint (safe - only runs if --expose-gc flag is set)
      if (global.gc) {
        global.gc();
      }
    }
  }

  async analyzeChatHistory(chat: any, systemPrompt: string, sendSSE: (data: any) => void) {
    try {
      // Reset step counter for chat analysis
      this.stepCounter = 0;
      
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

      console.info('Continuing conversation with proper chat history');
      
      // Important: Use the returned messages from processStream to keep state
      const updatedMessages = await this.processStream(chatMessages, systemPrompt, sendSSE);
      console.info('Finished processing chat history:', { 
        messageCount: updatedMessages.length,
        lastMessageRole: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1].role : 'none',
        finalStepCount: this.stepCounter
      });
      
      return updatedMessages;
    } catch (error) {
      console.error('Error in analyzeChatHistory:', error);
      sendSSE({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
