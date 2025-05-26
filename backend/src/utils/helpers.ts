import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Response } from 'express';
import { DTOChatMessage } from '../types/firestore.js';

export const generateUniqueId = (): string => {
  return uuidv4();
};

export const getCurrentTimestamp = (): number => {
  return Date.now();
};

// Helper function to find complete tag content in Claude's responses
export const findCompleteTagContent = (tagName: string, buffer: string): { fullMatch: string; content: string } | null => {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  // Use regex to handle multiline content better
  const regex = new RegExp(`${startTag}\\s*([\\s\\S]*?)\\s*${endTag}`);
  const match = buffer.match(regex);
  
  if (!match) return null;
  
  const content = match[1];
  // Skip empty tags
  if (!content.trim()) {
    return null;
  }
  
  // Return the full match for replacement and the content for processing
  return {
    fullMatch: match[0],
    content: content.trim()
  };
};

// Helper function to set up SSE response
export const setupSSEResponse = (res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
};

// Configuration for chat message filtering
const LARGE_TOOL_RESPONSES = [
  'fetch_markdown',
  'get_cds_data'
];

const MAX_TOOL_RESPONSE_LENGTH = 500;

/**
 * Filters chat messages to truncate large tool responses before saving to storage
 * @param messages Array of chat messages to filter
 * @returns Filtered array with large tool responses truncated
 */
export const filterChatMessages = (messages: DTOChatMessage[]): DTOChatMessage[] => {
  return messages.map(message => {
    // Only filter user messages that contain tool responses
    if (message.role !== 'user') {
      return message;
    }

    // Check if this message contains a large tool response
    for (const toolName of LARGE_TOOL_RESPONSES) {
      const toolPrefix = `Tool ${toolName} returned:`;
      if (message.content.startsWith(toolPrefix)) {
        // If the content is longer than our limit, truncate it
        if (message.content.length > MAX_TOOL_RESPONSE_LENGTH) {
          const truncatedContent = message.content.substring(0, MAX_TOOL_RESPONSE_LENGTH);
          return {
            ...message,
            content: `${truncatedContent}... [truncated for storage - original length: ${message.content.length} characters]`
          };
        }
        // If it's under the limit, keep as-is
        return message;
      }
    }

    // Not a large tool response, return unchanged
    return message;
  });
};
