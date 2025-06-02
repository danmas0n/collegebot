import express, { Request, Response } from 'express';
import { AIServiceFactory } from '../services/ai-service-factory.js';
import { setupSSEResponse } from '../utils/helpers.js';
import { getBasePrompt } from '../prompts/base.js';
import { getStudent, getMapLocations, getChats } from '../services/firestore.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Stream pin research and create plan
router.post('/stream', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);
  
  try {
    const { studentId, pinIds, pinNames } = req.body;
    
    if (!studentId || !pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      throw new Error('Student ID and pin IDs are required');
    }
    
    logger.info('Starting pin research stream', { studentId, pinIds, pinNames });
    
    // Get student data
    const student = await getStudent(studentId, req.user.uid);
    if (!student) {
      throw new Error('Student not found');
    }
    
    // Get map locations to resolve pin names and gather context
    const mapLocations = await getMapLocations(studentId, req.user.uid);
    const selectedLocations = [];
    
    for (const pinId of pinIds) {
      const location = mapLocations.find(loc => loc.id === pinId);
      if (location) {
        selectedLocations.push(location);
        logger.info('Resolved pin', { pinId, name: location.name, type: location.type });
      } else {
        logger.warn('Pin not found in map locations', { pinId });
      }
    }
    
    // Get chats to find source context
    const chats = await getChats(studentId);
    
    // Build rich context for each college
    let collegeContexts = [];
    for (const location of selectedLocations) {
      let context = {
        name: location.name,
        type: location.type,
        metadata: location.metadata || {},
        sourceChats: location.sourceChats || [],
        chatContext: ''
      };
      
      // Find source chat context if available
      if (location.sourceChats && location.sourceChats.length > 0) {
        const sourceChatId = location.sourceChats[0]; // Use first source chat
        const sourceChat = chats.find(chat => chat.id === sourceChatId);
        if (sourceChat) {
          // Extract relevant context from the chat
          const relevantMessages = sourceChat.messages
            .filter(msg => msg.role === 'assistant' && msg.content.toLowerCase().includes(location.name.toLowerCase()))
            .slice(-2); // Get last 2 relevant messages
          
          if (relevantMessages.length > 0) {
            context.chatContext = relevantMessages.map(msg => msg.content).join('\n\n');
          }
        }
      }
      
      collegeContexts.push(context);
    }
    
    logger.info('Starting research for colleges with context', { 
      colleges: collegeContexts.map(c => ({ name: c.name, hasContext: !!c.chatContext })) 
    });
    
    // Build enhanced research prompt with context
    let contextualPrompt = `I need you to create a comprehensive application plan for the following college(s). Each college has been previously identified as a good fit for ${student.name}, and I'm providing you with the existing context and analysis.

`;
    
    // Add context for each college
    for (const context of collegeContexts) {
      contextualPrompt += `## ${context.name}
`;
      contextualPrompt += `**Type:** ${context.type}\n`;
      
      // Add metadata context
      if (context.metadata.fitScore) {
        contextualPrompt += `**Fit Score:** ${context.metadata.fitScore}/100\n`;
      }
      if (context.metadata.reason) {
        contextualPrompt += `**Why it's a good fit:** ${context.metadata.reason}\n`;
      }
      if (context.metadata.description) {
        contextualPrompt += `**Description:** ${context.metadata.description}\n`;
      }
      
      // Add source chat context
      if (context.chatContext) {
        contextualPrompt += `**Previous Analysis:**\n${context.chatContext}\n`;
      }
      
      contextualPrompt += `\n`;
    }
    
    contextualPrompt += `
Now, building on this existing analysis, please create a detailed application success plan for ${student.name}. Focus on maximizing their chances of admission to these specific colleges.

Please follow this workflow:
1. For each college, research current application requirements and deadlines:
   - Application deadlines (regular, early action, early decision)
   - Financial aid and scholarship deadlines  
   - Application requirements (essays, recommendations, tests)
   - Housing application deadlines
   - Any special programs or opportunities

2. Create a comprehensive application plan that includes:
   - Timeline of all important deadlines
   - Required application components
   - Recommended preparation steps
   - Financial aid strategy
   - Scholarship opportunities
   - Ways to strengthen the application based on the college's preferences

3. Use the available tools to:
   - Search for current college information
   - Get Common Data Set information
   - Create calendar items and tasks in the system

Provide detailed, actionable guidance that builds on the existing analysis and helps ${student.name} create the strongest possible application for these colleges.`;
    
    const researchPrompt = contextualPrompt;

    // Generate system prompt with plan creation tools
    const systemPrompt = await getBasePrompt(student.name, student, 'plan_building', req);
    
    // Create messages array for the research
    const messages = [
      {
        role: 'user' as const,
        content: researchPrompt
      }
    ];
    
    // Process with AI service
    const aiService = await AIServiceFactory.createService(req.user.uid);
    logger.info('Starting pin research processing with AI service');
    
    await aiService.processSingleStream(messages, systemPrompt, sendSSE);
    
    logger.info('Pin research stream completed successfully');
    
  } catch (error) {
    logger.error('Error in pin research stream:', error);
    // Send error through SSE before closing
    sendSSE({ 
      type: 'error',
      content: `Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    sendSSE({ type: 'complete' });
  }
});

export default router;
