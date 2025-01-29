import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface McpToolResponse {
  content: Array<{
    text: string;
  }>;
}

export const executeMcpTool = async (server: string, toolName: string, params: Record<string, any>): Promise<McpToolResponse> => {
  const transport = new StdioClientTransport({
    command: "node",
    args: [`../mcp/${server}-server/dist/index.js`]
  });

  const client = new Client(
    {
      name: server,
      version: "1.0.0"
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {}
      }
    }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: toolName,
      arguments: params
    });

    // Transform the result to match our expected format
    const transformedResult: McpToolResponse = {
      content: [{
        text: typeof result === 'string' ? result : JSON.stringify(result)
      }]
    };

    transport.close();
    return transformedResult;
  } catch (error) {
    transport.close();
    throw error;
  }
}; 