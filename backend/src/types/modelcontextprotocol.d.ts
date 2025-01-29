declare module '@modelcontextprotocol/sdk' {
  export class McpClient {
    constructor(options: {
      serverName: string;
      transport: 'stdio';
      serverPath: string;
    });

    connect(): Promise<void>;
    disconnect(): Promise<void>;
    executeTool(toolName: string, params: Record<string, any>): Promise<any>;
  }
} 