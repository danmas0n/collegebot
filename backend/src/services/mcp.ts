import { spawn } from 'child_process';

// Types for MCP tool responses
export interface McpToolResponse {
  content: Array<{
    text: string;
    type?: string;
  }>;
  error?: string;
}

export type McpToolName = 'college-data';

export interface McpToolOptions {
  [key: string]: any;
}

export async function executeMcpTool(
  toolName: McpToolName,
  functionName: string,
  options: McpToolOptions = {}
): Promise<McpToolResponse> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      '-m',
      'college_data_server.main',
      toolName,
      functionName,
      JSON.stringify(options)
    ]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`MCP tool error (${code}):`, errorData);
        reject(new Error(`MCP tool failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse MCP tool output:', error);
        reject(error);
      }
    });
  });
}
