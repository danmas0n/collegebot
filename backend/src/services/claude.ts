import { Anthropic } from '@anthropic-ai/sdk';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { ResponseProcessor } from '../utils/response-processor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';
import { claudeLogger } from '../utils/logger.js';

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

  constructor(apiKey: string, userId?: string) {
    this.client = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com'
    });
    this.userId = userId;
    this.responseProcessor = new ResponseProcessor();
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
   * Log cache performance metrics
   */
  private logCachePerformance(usage: any) {
    if (usage) {
      const cacheCreated = usage.cache_creation_input_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const regularInput = usage.input_tokens || 0;
      const output = usage.output_tokens || 0;

      claudeLogger.info('Cache Performance', {
        cache_creation_tokens: cacheCreated,
        cache_read_tokens: cacheRead,
        regular_input_tokens: regularInput,
        output_tokens: output,
        cache_hit_rate: cacheRead > 0 ? (cacheRead / (cacheRead + regularInput)) * 100 : 0,
        estimated_savings: cacheRead > 0 ? `${(cacheRead * 0.9).toFixed(0)} tokens saved` : 'No cache hits'
      });
    }
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

    // Reset processor for new conversation
    this.responseProcessor.reset();

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
    claudeLogger.info('Starting Claude stream');
    let toolBuffer = '';
    let messageContent = '';
    let hasToolCalls = false;
    let continueProcessing = true;
    let rawMessage = ''; // Track complete raw message

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

      console.info('System prompt', {
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

      for await (const streamEvent of stream) {
        if (streamEvent.type === 'message_start') {
          console.info('Message start');
          toolBuffer = '';
          messageContent = '';
          rawMessage = ''; // Reset raw message buffer
          
          // Log cache performance if available
          if (streamEvent.message?.usage) {
            this.logCachePerformance(streamEvent.message.usage);
          }
        }
        else if (streamEvent.type === 'content_block_start') {
          console.info('Content block start');
        }
        else if (streamEvent.type === 'content_block_delta' && streamEvent.delta.type === 'text_delta') {
          const text = streamEvent.delta.text;
          toolBuffer += text;
          rawMessage += text; // Accumulate raw message

          // Check for complete tool call first - if found, terminate the stream
          const { found, toolResult } = detectToolCall(toolBuffer);
          if (found && toolResult) {
            console.info('Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
            
            // Cancel the stream
            stream.abort();
            
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
        }
        else if (streamEvent.type === 'message_stop') {
          console.info('Message complete', { 
            hasContent: !!(toolBuffer.trim() || messageContent.trim())
          });
          
          // Log complete raw message before processing
          console.info('Complete raw message', { message: rawMessage });
           
          // At message_stop, check if we received any content
          if (!toolBuffer.trim() && !messageContent.trim()) {
            console.info('No content received, skipping processing');
            return { hasToolCalls, messages, continueProcessing: false };
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

      return { hasToolCalls, messages, continueProcessing };
    } catch (error: any) {
      claudeLogger.error('Error in stream processing', { error: error.message, stack: error.stack });
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

      console.info('Continuing conversation with proper chat history');
      
      // Important: Use the returned messages from processStream to keep state
      const updatedMessages = await this.processStream(chatMessages, systemPrompt, sendSSE);
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
