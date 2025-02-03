import express, { Request, Response, RequestHandler } from 'express';
import { executeMcpTool } from '../services/mcp';

const router = express.Router();

interface SearchRequest {
  query: string;
}

interface CompareRequest {
  colleges: string[];
}

// Search colleges
const searchColleges: RequestHandler<{}, any, SearchRequest> = async (req, res) => {
  try {
    console.log('Backend - Received search request:', req.body);
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
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

      const text = result.content[0].text;
      if (typeof text !== 'string') {
        throw new Error('Invalid response: expected text to be a string');
      }
      const collegeData = JSON.parse(text);
      res.json(collegeData);
    } catch (mcpError) {
      console.error('Backend - MCP tool error:', mcpError);
      throw new Error('College data server error');
    }
  } catch (error) {
    console.error('Backend - Search error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search colleges' });
  }
};

// Get college details
const getCollegeDetails: RequestHandler<{ id: string }> = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Backend - Getting college details for:', id);
    
    const result = await executeMcpTool('college-data', 'get_college_details', { id });
    
    if (!result?.content?.[0]?.text) {
      throw new Error('Invalid response format from college-data server');
    }

    const text = result.content[0].text;
    if (typeof text !== 'string') {
      throw new Error('Invalid response: expected text to be a string');
    }
    const collegeDetails = JSON.parse(text);
    res.json(collegeDetails);
  } catch (error) {
    console.error('Backend - Get college details error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get college details' });
  }
};

// Compare colleges
const compareColleges: RequestHandler<{}, any, CompareRequest> = async (req, res) => {
  try {
    const { colleges } = req.body;
    if (!colleges || !Array.isArray(colleges)) {
      res.status(400).json({ error: 'Colleges array is required' });
      return;
    }

    const result = await executeMcpTool('college-data', 'compare_colleges', { colleges });
    
    if (!result?.content?.[0]?.text) {
      throw new Error('Invalid response format from college-data server');
    }

    const text = result.content[0].text;
    if (typeof text !== 'string') {
      throw new Error('Invalid response: expected text to be a string');
    }
    const comparison = JSON.parse(text);
    res.json(comparison);
  } catch (error) {
    console.error('Backend - Compare colleges error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to compare colleges' });
  }
};

router.post('/search', searchColleges);
router.get('/:id', getCollegeDetails);
router.post('/compare', compareColleges);

export default router;
