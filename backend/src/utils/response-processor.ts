import { findCompleteTagContent } from './helpers.js';
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

interface ProcessingResult {
  updatedBuffer: string;
  messages: Message[];
  savedAnswer: string | null;
  researchTasks: ResearchTask[];
  hasContent: boolean;
}

export class ResponseProcessor {
  private savedAnswer: string | null = null;
  private researchTasks: ResearchTask[] = [];
  private titleSent: boolean = false; // Track if title has been sent to prevent duplication

  /**
   * Process XML tags in the buffer and send appropriate SSE events
   */
  processXmlTags(
    buffer: string, 
    messages: Message[], 
    sendSSE: (data: any) => void
  ): ProcessingResult {
    let workingBuffer = buffer;
    let hasContent = false;

    // Process thinking tags
    let thinkingResult;
    while ((thinkingResult = findCompleteTagContent('thinking', workingBuffer))) {
      sendSSE({ 
        type: 'thinking', 
        content: thinkingResult.content
      });
      console.info('Found complete thinking tag', { content: thinkingResult.content });
      workingBuffer = workingBuffer.replace(thinkingResult.fullMatch, '');
      hasContent = true;
    }

    // Process answer tags
    let answerResult;
    while ((answerResult = findCompleteTagContent('answer', workingBuffer))) {
      this.savedAnswer = answerResult.content;
      messages.push({
        role: 'answer',
        content: answerResult.content
      });
      
      // Extract research tasks from the answer
      this.researchTasks = this.extractResearchTasks(answerResult.content);
      
      sendSSE({ 
        type: 'response', 
        content: answerResult.content,
        researchTasks: this.researchTasks
      });
      console.info('Found complete answer tag', { content: answerResult.content });
      workingBuffer = workingBuffer.replace(answerResult.fullMatch, '');
      hasContent = true;
    }

    // Process title tags
    let titleResult;
    while ((titleResult = findCompleteTagContent('title', workingBuffer))) {
      // FIXED: Only send title information, don't duplicate the answer content
      // If we already have a saved answer, just send the title metadata
      if (this.savedAnswer && !this.titleSent) {
        sendSSE({
          type: 'title',
          suggestedTitle: titleResult.content.trim(),
          researchTasks: this.researchTasks
        });
        this.titleSent = true;
      } else if (!this.savedAnswer) {
        // If no saved answer yet, send as response with title
        sendSSE({
          type: 'response',
          content: this.savedAnswer,
          suggestedTitle: titleResult.content.trim(),
          researchTasks: this.researchTasks
        });
      }
      
      console.info('Found complete title tag', { 
        content: titleResult.content,
        trimmedContent: titleResult.content.trim(),
        savedAnswer: this.savedAnswer ? 'exists' : 'null',
        titleSent: this.titleSent,
        fullMatch: titleResult.fullMatch
      });
      workingBuffer = workingBuffer.replace(titleResult.fullMatch, '');
      hasContent = true;
    }

    return {
      updatedBuffer: workingBuffer,
      messages,
      savedAnswer: this.savedAnswer,
      researchTasks: this.researchTasks,
      hasContent
    };
  }

  /**
   * Extract research tasks from content
   */
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

  /**
   * Validate research task structure
   */
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

  /**
   * Consolidate thinking, answer, and question messages into structured assistant messages
   */
  consolidateMessages(messages: Message[]): Message[] {
    const consolidated: Message[] = [];
    let pendingThinking = '';
    let pendingAnswer = '';
    let pendingQuestion = '';

    for (const message of messages) {
      if (message.role === 'user') {
        // Before adding user message, consolidate any pending assistant content
        if (pendingThinking || pendingAnswer || pendingQuestion) {
          const structuredContent = this.buildStructuredContent(pendingThinking, pendingAnswer, pendingQuestion);
          consolidated.push({
            role: 'assistant',
            content: structuredContent
          });
          pendingThinking = '';
          pendingAnswer = '';
          pendingQuestion = '';
        }
        consolidated.push(message);
      } else if (message.role === 'thinking') {
        pendingThinking = message.content;
      } else if (message.role === 'answer') {
        pendingAnswer = message.content;
      } else if (message.role === 'question') {
        pendingQuestion = message.content;
      } else if (message.role === 'assistant') {
        // Direct assistant message, add as-is after consolidating pending
        if (pendingThinking || pendingAnswer || pendingQuestion) {
          const structuredContent = this.buildStructuredContent(pendingThinking, pendingAnswer, pendingQuestion);
          consolidated.push({
            role: 'assistant',
            content: structuredContent
          });
          pendingThinking = '';
          pendingAnswer = '';
          pendingQuestion = '';
        }
        consolidated.push(message);
      }
    }

    // Handle any remaining pending content
    if (pendingThinking || pendingAnswer || pendingQuestion) {
      const structuredContent = this.buildStructuredContent(pendingThinking, pendingAnswer, pendingQuestion);
      consolidated.push({
        role: 'assistant',
        content: structuredContent
      });
    }

    return consolidated;
  }

  /**
   * Build structured content with thinking, answer, and question tags
   */
  private buildStructuredContent(thinking: string, answer: string, question: string): string {
    let content = '';
    
    if (thinking) {
      content += `<thinking>${thinking}</thinking>`;
    }
    
    if (answer) {
      content += `<answer>${answer}</answer>`;
    }
    
    if (question) {
      content += `<question>${question}</question>`;
    }
    
    return content;
  }

  /**
   * Handle remaining content after processing all tags.
   *
   * When Claude doesn't wrap content in <answer> tags (despite prompt instructions),
   * the remaining content after stripping <thinking>, <title>, and <tool> tags
   * should still be treated as the answer. This provides a fallback to ensure
   * user-facing content isn't lost.
   */
  handleRemainingContent(
    buffer: string,
    messages: Message[],
    sendSSE: (data: any) => void
  ): { messages: Message[]; hasContent: boolean } {
    const remainingContent = buffer.trim();

    if (!this.savedAnswer && remainingContent) {
      // Treat remaining content as the answer (fallback when <answer> tags are missing)
      // This handles cases where Claude outputs content without explicit <answer> tags
      console.info('No explicit <answer> tags found, treating remaining content as answer', {
        contentLength: remainingContent.length,
        preview: remainingContent.substring(0, 200)
      });

      this.savedAnswer = remainingContent;
      messages.push({
        role: 'answer',
        content: remainingContent
      });

      // Extract any research tasks from this content
      this.researchTasks = this.extractResearchTasks(remainingContent);

      sendSSE({
        type: 'response',
        content: remainingContent,
        researchTasks: this.researchTasks
      });
      return { messages, hasContent: true };
    }

    return { messages, hasContent: false };
  }

  /**
   * Reset processor state for new conversation
   */
  reset(): void {
    this.savedAnswer = null;
    this.researchTasks = [];
    this.titleSent = false; // Reset title sent flag
  }

  /**
   * Get current saved answer
   */
  getSavedAnswer(): string | null {
    return this.savedAnswer;
  }

  /**
   * Get current research tasks
   */
  getResearchTasks(): ResearchTask[] {
    return this.researchTasks;
  }
}
