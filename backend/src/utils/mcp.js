import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// Helper function to create MCP client
export const createMcpClient = async (serverName) => {
  // Base environment with PATH
  let env = { PATH: process.env.PATH };
  let command, args;
  
  switch (serverName) {
    case 'college-data':
      command = 'node';
      args = ['../mcp/college-data-server/build/index.js'];
      env = {
        ...env,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID
      };
      break;
    case 'student-data':
      command = 'node';
      args = ['../mcp/student-data-server/build/index.js'];
      break;
    case 'fetch':
      command = 'uvx';
      // temporary -- when mcp 1.1.4 is released remove --with
      args = ['--with','mcp==1.1.2','mcp-server-fetch'];
      break;
    case 'memory':
      command = 'npx';
      args = ['-y', '@modelcontextprotocol/server-memory'];
      break;
    default:
      throw new Error(`Unknown MCP server: ${serverName}`);
  }

  const transport = new StdioClientTransport({
    command,
    args,
    env
  });

  const client = new Client({
    name: "collegebot-backend",
    version: "1.0.0",
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
};

// Helper function to execute MCP tool
export const executeMcpTool = async (serverName, toolName, args) => {
  let client;
  try {
    console.log('Backend - Creating MCP client for:', serverName);
    client = await createMcpClient(serverName);
    console.log('Backend - MCP client created and connected');

    const request = {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };
    console.log('Backend - Sending MCP request:', request);

    const result = await client.request(request, CallToolResultSchema);
    console.log('Backend - Raw MCP response type:', typeof result);
    console.log('Backend - Raw MCP response keys:', result ? Object.keys(result) : 'null');
    const rawResponse = JSON.stringify(result, null, 2);
    console.log('Backend - Raw MCP response:', rawResponse.slice(0, 200) + (rawResponse.length > 200 ? '...' : ''));

    if (!result) {
      throw new Error('MCP server returned null response');
    }

    return result;
  } catch (error) {
    // Extract the meaningful error message from MCP error chain
    let errorMessage = error.message;
    if (errorMessage.includes('MCP error -32603:')) {
      errorMessage = errorMessage.split('MCP error -32603:').pop().trim();
    }
    console.error('Backend - MCP error:', errorMessage);
    throw new Error(errorMessage);
  } finally {
    if (client) {
      console.log('Backend - Closing MCP client');
      await client.close();
      console.log('Backend - MCP client closed');
    }
  }
};
