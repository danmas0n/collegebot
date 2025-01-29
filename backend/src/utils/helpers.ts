import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Response } from 'express';

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