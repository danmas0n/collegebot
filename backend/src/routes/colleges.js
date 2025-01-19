import express from 'express';
import { executeMcpTool } from '../utils/mcp.js';
import { storeCollegeData, formatCollegeDataForComparison } from '../utils/helpers.js';

const router = express.Router();

// Search colleges
router.post('/search', async (req, res) => {
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

      try {
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
            await storeCollegeData(college, executeMcpTool);
          }
        }

        console.log('Backend - Sending successful response');
        res.json(data);
      } catch {
        // If parsing fails, send the raw text
        console.log('Backend - Sending raw response');
        res.json({ text: result.content[0].text });
      }
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

// Get college data
router.get('/:name', async (req, res) => {
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

// Compare colleges
router.post('/compare', async (req, res) => {
  try {
    const { message, colleges } = req.body;
    
    if (!message || !colleges || !Array.isArray(colleges) || colleges.length === 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    // Format college data for comparison
    const collegeData = await formatCollegeDataForComparison(colleges, executeMcpTool);

    // Generate response based on the question and college data
    let response = "Based on the Common Data Set information:\n\n";

    if (message.toLowerCase().includes('financial aid') || message.toLowerCase().includes('scholarship')) {
      response += collegeData.map(college => {
        const aid = college.sections?.financialAid || '';
        return `${college.name}:\n${aid}\n`;
      }).join('\n');
    } else if (message.toLowerCase().includes('expense') || message.toLowerCase().includes('cost')) {
      response += collegeData.map(college => {
        const expenses = college.sections?.expenses || '';
        return `${college.name}:\n${expenses}\n`;
      }).join('\n');
    } else if (message.toLowerCase().includes('admission')) {
      response += collegeData.map(college => {
        const admissions = college.sections?.admissions || '';
        return `${college.name}:\n${admissions}\n`;
      }).join('\n');
    } else {
      // General comparison
      response += collegeData.map(college => {
        return `${college.name}:\n` +
               `- Admissions: ${college.sections?.admissions ? 'Available' : 'Not available'}\n` +
               `- Financial Aid: ${college.sections?.financialAid ? 'Available' : 'Not available'}\n` +
               `- Expenses: ${college.sections?.expenses ? 'Available' : 'Not available'}\n`;
      }).join('\n');
    }

    res.json({ response });
  } catch (error) {
    console.error('College comparison error:', error);
    res.status(500).json({ error: 'Failed to process comparison request' });
  }
});

export default router;
