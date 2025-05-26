import { findCompleteTagContent } from './helpers.js';
import { executeMcpTool } from '../services/mcp.js';
import { toolServerMap } from '../config/mcp-tools.js';
import { Message } from '../types/messages.js';

type ToolName = keyof typeof toolServerMap;

/**
 * Processes a tool call and executes the tool
 * @param toolContent The content of the tool call
 * @param messages The current message history
 * @param sendSSE Function to send server-sent events
 * @param userId Optional user ID for tool execution
 * @returns Object containing updated messages and flags
 */
export async function executeToolCall(
  toolContent: string,
  messages: Message[],
  sendSSE: (data: any) => void,
  userId?: string
): Promise<{ messages: Message[]; hasToolCalls: boolean; continueProcessing: boolean }> {
  try {
    console.info('Parsing tool call content:', {
      preview: toolContent.substring(0, 200) + (toolContent.length > 200 ? '...' : ''),
      length: toolContent.length
    });
    const nameMatch = toolContent.match(/<name>(.*?)<\/name>/s);
    const paramsMatch = toolContent.match(/<parameters>([\s\S]*?)<\/parameters>/);
    
    if (!nameMatch || !paramsMatch) {
      console.error('Malformed tool call:', {
        nameMatchFound: !!nameMatch,
        paramsMatchFound: !!paramsMatch,
        toolContent: toolContent.substring(0, 300) + (toolContent.length > 300 ? '...' : '')
      });
      throw new Error('Malformed tool call - missing name or parameters');
    }

    const toolName = nameMatch[1].trim() as ToolName;
    console.info('Tool name extracted:', { toolName });
    
    try {
      const params = JSON.parse(paramsMatch[1].trim());

      // Get the appropriate server for this tool
      const server = toolServerMap[toolName];
      if (!server) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Send tool use notification
      sendSSE({ 
        type: 'thinking', 
        content: `Using ${toolName} tool...`,
        toolData: JSON.stringify(params, null, 2)
      });

      // Execute tool
      console.info('Starting tool execution', { server, toolName, params });
      const toolResult = await executeMcpTool(server, toolName, params, userId);
      
      // Log tool result preview
      const textContent = toolResult?.content?.[0]?.text;
      const resultPreview = typeof textContent === 'string' 
        ? textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '')
        : 'No text content in result or not a string';
      console.info('Tool execution successful, processing result:', {
        preview: resultPreview,
        contentLength: typeof textContent === 'string' ? textContent.length : 0,
        contentType: typeof textContent
      });

      // Process tool result
      if (toolResult?.content?.[0]?.text) {
        // Add tool result to conversation
        messages.push({
          role: 'user',
          content: `Tool ${toolName} returned: ${toolResult.content[0].text}`
        });

        // Send tool result to frontend
        try {
          // Try to parse as JSON for pretty printing
          const text = toolResult.content[0].text;
          if (text && typeof text === 'string') {
            const parsedResult = JSON.parse(text);
            sendSSE({ 
              type: 'thinking',
              content: `Tool ${toolName} result:`,
              toolData: JSON.stringify(parsedResult, null, 2)
            });
          } else {
            throw new Error('Invalid tool result text format');
          }
        } catch {
          // If parsing fails, send as-is
          sendSSE({ 
            type: 'thinking',
            content: `Tool ${toolName} result:`,
            toolData: toolResult.content[0].text
          });
        }
        
        // Set flags to continue processing
        return { 
          messages, 
          hasToolCalls: true, 
          continueProcessing: true 
        };
        
      } else {
        console.error('Invalid tool result format', { toolResult });
        throw new Error('Invalid tool result format');
      }
    } catch (error: any) {
      console.error('Error executing tool', { error: error.message, stack: error.stack });
      // Add error message to conversation
      messages.push({
        role: 'user',
        content: `Tool ${toolName} error: ${error.message}`
      });
      // Send error to frontend
      sendSSE({ 
        type: 'thinking',
        content: `Error executing tool: ${error.message}`
      });
      // Continue processing
      return { 
        messages, 
        hasToolCalls: true, 
        continueProcessing: true 
      };
    }
  } catch (error: any) {
    console.error('Error parsing tool call', { error: error.message, stack: error.stack });
    // Add error message to conversation
    messages.push({
      role: 'user',
      content: `Tool call error: ${error.message}`
    });
    // Send error to frontend
    sendSSE({ 
      type: 'thinking',
      content: `Error parsing tool call: ${error.message}`
    });
    // Continue processing
    return { 
      messages, 
      hasToolCalls: true, 
      continueProcessing: true 
    };
  }
}

/**
 * Detects and processes a complete tool call in the buffer
 * @param toolBuffer The current buffer of text from the LLM
 * @param messages The current message history
 * @param sendSSE Function to send server-sent events
 * @param userId Optional user ID for tool execution
 * @returns Object containing the tool result, updated messages, and whether a tool call was found
 */
export function detectToolCall(toolBuffer: string): { 
  found: boolean; 
  toolResult: { fullMatch: string; content: string } | null;
} {
  const toolResult = findCompleteTagContent('tool', toolBuffer);
  return {
    found: !!toolResult,
    toolResult
  };
}
