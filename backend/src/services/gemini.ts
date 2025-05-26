import { GoogleGenerativeAI } from '@google/generative-ai';
import { findCompleteTagContent } from '../utils/helpers.js';
import { detectToolCall, executeToolCall } from '../utils/tool-executor.js';
import { settingsService } from './settings.js';
import { Message } from '../types/messages.js';

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

export class GeminiService {
  private client: GoogleGenerativeAI;
  private userId?: string;

  constructor(apiKey: string, userId?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
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
    let rawMessage = ''; // Track complete raw message
    let researchTasks: ResearchTask[] = [];

    try {
      // Map our roles to Gemini's roles
      const geminiMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      console.info('System prompt', {
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
      let responseText = '';
      let streamController = new AbortController();

      for await (const chunk of result.stream) {
        const text = chunk.text();
        responseText += text;
        toolBuffer += text;
        rawMessage += text;

        // Check for complete tool call first - if found, terminate the stream
        const { found, toolResult } = detectToolCall(toolBuffer);
        if (found && toolResult) {
          console.info('Found complete tool call, terminating stream', { toolCall: toolResult.fullMatch });
          
          // Cancel the stream - Gemini doesn't have a direct abort method, but we can break out of the loop
          streamController.abort();
          
          // Process the tool call using the shared utility
          const result = await executeToolCall(toolResult.content, messages, sendSSE, this.userId);
          
          // Return the result
          return result;
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
              sendSSE({ 
                type: 'response', 
                content: result.content,
                researchTasks
              });
            } else if (tagName === 'title') {
              // Send title with the saved answer
              sendSSE({
                type: 'response',
                content: savedAnswer,
                suggestedTitle: result.content.trim(),
                researchTasks
              });
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
          return { hasToolCalls, messages, continueProcessing };
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
      return { hasToolCalls, messages, continueProcessing };
    } catch (error: any) {
      console.error('Error in stream processing', error);
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
