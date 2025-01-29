import { createHash } from 'crypto';

// Helper function to find complete tag content in Claude's responses
export const findCompleteTagContent = (tagName, buffer) => {
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

// Helper function to generate a unique conversation ID
export const generateConversationId = (colleges) => {
  const collegeNames = colleges.map(c => c.name).sort().join('|');
  return createHash('md5').update(collegeNames).digest('hex');
};

// Helper function to store college data in memory
export const storeCollegeData = async (college, executeMcpTool) => {
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

// Helper function to format college data for comparison
export const formatCollegeDataForComparison = async (colleges, executeMcpTool) => {
  const formattedData = [];
  
  for (const college of colleges) {
    try {
      // Get CDS data including sections and full content
      const cdsData = await executeMcpTool('college-data', 'get_cds_data', {
        collegeName: college.name
      });
      
      const parsedData = cdsData?.content?.[0]?.text ? JSON.parse(cdsData.content[0].text) : {};
      formattedData.push({
        name: college.name,
        sections: parsedData.sections || {},
        fullContent: parsedData.fullText || ''
      });
    } catch (error) {
      console.error(`Error formatting data for ${college.name}:`, error);
    }
  }
  
  return formattedData;
};

// Helper function to set up SSE response
export const setupSSEResponse = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  return (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
};
