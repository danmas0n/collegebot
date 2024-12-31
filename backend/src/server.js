import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// Helper function to create MCP client
const createMcpClient = async (serverName) => {
  let command, args;
  
  switch (serverName) {
    case 'college-data':
      command = 'node';
      args = ['../mcp/college-data-server/build/index.js'];
      break;
    case 'fetch':
      command = 'npx';
      args = ['-y', '@modelcontextprotocol/server-fetch'];
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
    args
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
const executeMcpTool = async (serverName, toolName, args) => {
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
    console.log('Backend - Raw MCP response:', JSON.stringify(result, null, 2));

    if (!result) {
      throw new Error('MCP server returned null response');
    }

    return result;
  } catch (error) {
    console.error('Backend - MCP error:', error);
    console.error('Backend - MCP error stack:', error.stack);
    throw error;
  } finally {
    if (client) {
      console.log('Backend - Closing MCP client');
      await client.close();
      console.log('Backend - MCP client closed');
    }
  }
};

// Routes
// Helper function to store college data in memory
const storeCollegeData = async (college) => {
  try {
    await executeMcpTool('memory', 'create_entities', {
      entities: [{
        name: college.name,
        entityType: 'college',
        observations: [
          JSON.stringify(college)
        ]
      }]
    });
  } catch (error) {
    console.error('Error storing college data:', error);
  }
};

app.post('/api/search', async (req, res) => {
  try {
    console.log('Backend - Received search request:', req.body);
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    try {
      // First, search using college-data server
      console.log('Backend - Starting college-data search for:', query);
      const result = await executeMcpTool('college-data', 'search_college_data', {
        query,
        includeWebSearch: true
      });

      console.log('Backend - Validating MCP response structure');
      if (!result?.content?.[0]?.text) {
        console.error('Backend - Invalid response format. Response:', result);
        throw new Error('Invalid response format from college-data server');
      }

      const data = JSON.parse(result.content[0].text);
      console.log('Backend - Successfully extracted data from response');
      console.log('Backend - Data structure:', {
        hasQuery: 'query' in data,
        resultsLength: data.results?.length
      });
      
      // Store results in memory if we have any
      if (data.results && Array.isArray(data.results)) {
        console.log('Backend - Storing', data.results.length, 'results in memory');
        for (const college of data.results) {
          await storeCollegeData(college);
        }
      }

      console.log('Backend - Sending successful response');
      res.json(data);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        error: 'Failed to search colleges',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search colleges' });
  }
});

app.get('/api/college/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await executeMcpTool('college-data', 'get_cds_data', {
      collegeName: name
    });

    res.json(result);
  } catch (error) {
    console.error('College data error:', error);
    res.status(500).json({ error: 'Failed to fetch college data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
