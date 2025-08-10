import express, { Request, Response } from 'express';
import { AIServiceFactory, setChatContextForService } from '../services/ai-service-factory.js';
import { ClaudeService } from '../services/claude.js';
import { setupSSEResponse, filterChatMessages } from '../utils/helpers.js';
import { getBasePrompt } from '../prompts/base.js';
import { getChats, getStudent, saveChat, deleteChat, getMapLocations } from '../services/firestore.js';
import { Chat, ChatDTO, DTOChatMessage, FirestoreChatMessage } from '../types/firestore.js';
import { Timestamp } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';
import { flowCostTracker } from '../services/flow-cost-tracker.js';

const router = express.Router();

// Handle individual messages
router.post('/message', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);
  let extractedTitle: string | null = null;
  
  // Wrap sendSSE to capture the title when it's sent
  const wrappedSendSSE = (data: any) => {
    logger.info('Backend - SSE event intercepted', { 
      type: data.type, 
      hasSuggestedTitle: !!data.suggestedTitle,
      suggestedTitle: data.suggestedTitle,
      hasContent: !!data.content,
      contentPreview: data.content ? data.content.substring(0, 100) : null
    });
    if (data.type === 'response' && data.suggestedTitle) {
      logger.info('Backend - Capturing title from SSE', { title: data.suggestedTitle });
      extractedTitle = data.suggestedTitle;
    }
    sendSSE(data);
  };
  
  try {
    const { message, studentData, studentName, history, chatId, studentId, title } = req.body;
    
    // Generate base prompt
    const systemPrompt = await getBasePrompt(studentName, studentData);

    // Process message with service
    const aiService = await AIServiceFactory.createService(req.user.uid);
    
    // Set chat context for cost tracking
    if (chatId) {
      setChatContextForService(aiService, chatId, 'recommendations');
      // Also set the student context for proper cost tracking
      if (aiService instanceof ClaudeService && studentId) {
        aiService.setStudentContext(studentId);
      }
    }
    
    const updatedMessages = await aiService.processStream(history, systemPrompt, wrappedSendSSE);
    
    // Don't save here anymore - let frontend handle saving with complete structure
    // Note: AI services now send the 'complete' event automatically
  } catch (error) {
    console.error('Error processing message:', error);
    // Send error through SSE before closing
    sendSSE({ 
      type: 'thinking',
      content: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    sendSSE({ type: 'complete' });
  }
});

// Get all chats for a student
router.post('/chats', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    const chats = await getChats(studentId);
    res.json({ chats });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Save complete frontend chat structure (preserves all message roles)
router.post('/save-frontend-chat', async (req: Request, res: Response) => {
  try {
    const { studentId, chat } = req.body;
    console.log('Backend - Saving frontend chat:', { 
      chatId: chat.id, 
      title: chat.title, 
      studentId: chat.studentId,
      messageCount: chat.messages?.length || 0,
      messageRoles: chat.messages?.map((m: any) => m.role) || []
    });
    
    if (!chat.studentId) {
      chat.studentId = studentId;
    }

    // Get existing chat to compare
    const existingChats = await getChats(studentId);
    const existingChat = existingChats.find(c => c.id === chat.id);

    // Mark as unprocessed if:
    // 1. It's a new chat (!existingChat)
    // 2. The number of messages has changed
    // 3. The chat was never processed
    if (!existingChat || 
        !chat.processed || 
        (existingChat && existingChat.messages.length !== chat.messages.length)) {
      chat.processed = false;
      chat.processedAt = null;
    }
    
    // Filter large tool responses before saving but preserve message roles
    const filteredChat = {
      ...chat,
      messages: filterChatMessages(chat.messages)
    };
    
    // Save the filtered chat
    await saveChat(filteredChat);
    console.log('Backend - Frontend chat saved successfully (with message filtering applied)');

    res.json({ message: 'Chat saved successfully' });
  } catch (error) {
    console.error('Backend - Error saving frontend chat:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save chat' });
  }
});

// Save chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { studentId, chat } = req.body;
    console.log('Backend - Saving chat:', { chatId: chat.id, title: chat.title, studentId: chat.studentId });
    
    if (!chat.studentId) {
      chat.studentId = studentId;
    }

    // Get existing chat to compare
    const existingChats = await getChats(studentId);
    const existingChat = existingChats.find(c => c.id === chat.id);

    // Mark as unprocessed if:
    // 1. It's a new chat (!existingChat)
    // 2. The number of messages has changed
    // 3. The chat was never processed
    if (!existingChat || 
        !chat.processed || 
        (existingChat && existingChat.messages.length !== chat.messages.length)) {
      chat.processed = false;
      chat.processedAt = null;
    }
    
    // Filter large tool responses before saving
    const filteredChat = {
      ...chat,
      messages: filterChatMessages(chat.messages)
    };
    
    // Save the filtered chat
    await saveChat(filteredChat);
    console.log('Backend - Chat saved successfully (with message filtering applied)');

    // DISABLED: Automatic chat processing - now using explicit processing via UI buttons
    // Research task processing has been removed

    res.json({ message: 'Chat saved successfully' });
  } catch (error) {
    console.error('Backend - Error saving chat:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save chat' });
  }
});

// Delete a chat
router.delete('/chats/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { studentId } = req.body;
    
    // Verify the chat belongs to the student
    const chats = await getChats(studentId);
    const chat = chats.find((c: ChatDTO) => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Delete the chat
    await deleteChat(chatId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Analyze chat -- meaning capture map pins and relevant links
// Mark chats as unprocessed
router.post('/mark-unprocessed', async (req: Request, res: Response) => {
  try {
    const { studentId, chatIds } = req.body;
    
    // Get all chats for the student
    const chats = await getChats(studentId);
    
    // Update each chat
    for (const chatId of chatIds) {
      const chat = chats.find((c: ChatDTO) => c.id === chatId);
      if (chat) {
        await saveChat({
          ...chat,
          processed: false,
          processedAt: null
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking chats as unprocessed:', error);
    res.status(500).json({ error: 'Failed to mark chats as unprocessed' });
  }
});

// Mark most recent chat as unprocessed
router.post('/mark-recent-unprocessed', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    console.log('mark-recent-unprocessed: Starting for studentId:', studentId);
    
    // Get all chats for the student
    const chats = await getChats(studentId);
    console.log('mark-recent-unprocessed: Found', chats.length, 'chats');
    console.log('mark-recent-unprocessed: Chat processed status:', chats.map(c => ({ id: c.id, title: c.title, processed: c.processed })));
    
    if (chats.length === 0) {
      return res.status(404).json({ error: 'No chats found' });
    }
    
    // Find the most recent chat (by updatedAt)
    const mostRecentChat = chats.reduce((latest, current) => {
      const latestDate = new Date(latest.updatedAt);
      const currentDate = new Date(current.updatedAt);
      return currentDate > latestDate ? current : latest;
    });
    
    console.log('mark-recent-unprocessed: Most recent chat:', {
      id: mostRecentChat.id,
      title: mostRecentChat.title,
      processed: mostRecentChat.processed,
      updatedAt: mostRecentChat.updatedAt
    });
    
    // Mark it as unprocessed
    const updatedChat = {
      ...mostRecentChat,
      processed: false,
      processedAt: null
    };
    
    console.log('mark-recent-unprocessed: Saving chat with processed=false');
    await saveChat(updatedChat);
    
    // Verify the save worked by re-fetching
    const verifyChats = await getChats(studentId);
    const verifyChat = verifyChats.find(c => c.id === mostRecentChat.id);
    console.log('mark-recent-unprocessed: Verification - chat processed status after save:', verifyChat?.processed);
    
    res.json({ 
      success: true, 
      chatId: mostRecentChat.id,
      chatTitle: mostRecentChat.title
    });
  } catch (error) {
    console.error('Error marking most recent chat as unprocessed:', error);
    res.status(500).json({ error: 'Failed to mark most recent chat as unprocessed' });
  }
});

// Process all chats for a student
router.post('/process-all', async (req: Request, res: Response) => {
  // Set up SSE response
  const sendSSE = setupSSEResponse(res);
  
  // Create processing session chat to capture the analysis
  const processingChatId = `map-processing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let processingMessages: any[] = [];
  let processingChatTitle = '';
  
  // Wrap sendSSE to capture messages for the processing chat
  const wrappedSendSSE = (data: any) => {
    // Capture analysis messages for the processing chat
    if (data.type === 'thinking' && data.content) {
      processingMessages.push({
        role: 'thinking',
        content: data.content,
        toolData: data.toolData,
        timestamp: new Date().toISOString()
      });
    }
    if (data.type === 'response' && data.content) {
      processingMessages.push({
        role: 'answer',
        content: data.content,
        timestamp: new Date().toISOString()
      });
    }
    if (data.type === 'status' && data.content && data.chatTitle) {
      // Add status messages to show processing progress
      processingMessages.push({
        role: 'user',
        content: `Processing: ${data.chatTitle}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Forward to original sendSSE
    sendSSE(data);
  };
  
  try {
    const { studentId } = req.body;
    
    // Get student data
    const student = await getStudent(studentId, req.user.uid);
    if (!student) {
      throw new Error('Student not found');
    }

    // Get all chats
    console.log('process-all: Starting for studentId:', studentId);
    const chats = await getChats(studentId);
    console.log('process-all: Found', chats.length, 'total chats');
    console.log('process-all: Chat processed status:', chats.map(c => ({ id: c.id, title: c.title, processed: c.processed })));
    
    const unprocessedChats = chats.filter(chat => !chat.processed);
    console.log('process-all: Found', unprocessedChats.length, 'unprocessed chats');
    console.log('process-all: Unprocessed chat IDs:', unprocessedChats.map(c => c.id));
    
    if (unprocessedChats.length === 0) {
      console.log('process-all: No unprocessed chats found, sending complete');
      sendSSE({ type: 'complete' });
      return;
    }

    // Set processing chat title
    processingChatTitle = `Map Processing: ${new Date().toLocaleDateString()} (${unprocessedChats.length} chats)`;
    
    // Add initial message to processing chat
    processingMessages.push({
      role: 'user',
      content: `Starting map processing session for ${unprocessedChats.length} unprocessed chats`,
      timestamp: new Date().toISOString()
    });

    // Send total count for progress tracking
    wrappedSendSSE({ 
      type: 'status',
      content: `Processing ${unprocessedChats.length} chats...`,
      total: unprocessedChats.length
    });
    
    // Process each chat with fresh system prompt (includes current map locations)
    const aiService = await AIServiceFactory.createService(req.user.uid);
    let processed = 0;

    for (const chat of unprocessedChats) {
      try {
        wrappedSendSSE({ 
          type: 'status',
          content: `Processing chat: ${chat.title || chat.id}`,
          chatTitle: chat.title || chat.id,
          progress: processed + 1,
          total: unprocessedChats.length
        });

        // CRITICAL: Generate fresh system prompt for each chat to include current map locations
        // This prevents duplicate pins by informing the AI of existing locations
        console.info(`Generating fresh system prompt for chat ${chat.id} to include current map locations`);
        const systemPrompt = await getBasePrompt(student.name, student, 'map_enrichment', req);

        // Set chat context for cost tracking
        setChatContextForService(aiService, chat.id, 'map');

        console.info(`Starting analysis of chat ${chat.id}: ${chat.title || 'Untitled Chat'}`);
        // FIXED: Pass wrappedSendSSE to capture analysis messages
        await aiService.analyzeChatHistory(chat, systemPrompt, wrappedSendSSE);

        // Research task processing has been removed

        await saveChat({
          ...chat,
          processed: true,
          processedAt: new Date().toISOString()
        });

        processed++;
      } catch (error) {
        console.error(`Error processing chat ${chat.id}:`, error);
        wrappedSendSSE({
          type: 'error',
          content: `Error processing chat: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    wrappedSendSSE({ type: 'complete' });
  } catch (error) {
    console.error('Error processing all chats:', error);
    res.status(500).json({ error: 'Failed to process chats' });
  } finally {
    // Always save the processing chat
    try {
      const { studentId } = req.body;
      
      // Add completion message
      processingMessages.push({
        role: 'answer',
        content: `Map processing completed. Analyzed ${processingMessages.filter(m => m.role === 'user' && m.content.startsWith('Processing:')).length} chats and updated map locations.`,
        timestamp: new Date().toISOString()
      });
      
      // Clean up messages to remove undefined values
      const cleanedMessages = processingMessages.map(msg => {
        const cleanedMsg: any = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        };
        
        if (msg.toolData && msg.toolData.trim() !== '') {
          cleanedMsg.toolData = msg.toolData;
        }
        
        return cleanedMsg;
      });
      
      // Create processing chat object
      const processingChat = {
        id: processingChatId,
        title: processingChatTitle || 'Map Processing Session',
        messages: cleanedMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studentId: studentId,
        type: 'map-processing', // Mark as map processing chat
        processed: true, // Mark as processed since it's the processing itself
        processedAt: new Date().toISOString()
      };
      
      // Save the processing chat
      await saveChat(processingChat);
      logger.info('Map processing chat saved', { chatId: processingChatId, title: processingChatTitle, messageCount: processingMessages.length });
      
    } catch (saveError) {
      logger.error('Error saving map processing chat:', saveError);
    }
  }
});

router.post('/analyze', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);

  try {
    console.log('\nBackend - Starting chat analysis');
    const { studentId, chatId, mode } = req.body;
    console.log('Backend - Analysis request:', { studentId, chatId, mode });
    
    // Get the chat content
    console.log('Backend - Fetching chat content');
    const chats = await getChats(studentId);
    const chat = chats.find((c: ChatDTO) => c.id === chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    // Get student data
    console.log('Backend - Fetching student data');
    const student = await getStudent(studentId, req.user.uid);
    if (!student) {
      throw new Error('Student not found');
    }

    // Generate system prompt with current map locations
    console.log('Backend - Generating system prompt with current map locations');
    const systemPrompt = await getBasePrompt(student.name, student, 'map_enrichment', req);

    // Process chat with service
    const aiService = await AIServiceFactory.createService(req.user.uid);
    
    // Set chat context for cost tracking
    setChatContextForService(aiService, chat.id, 'map');
    
    console.info(`Starting analysis of single chat ${chat.id}: ${chat.title || 'Untitled Chat'}`);
    await aiService.analyzeChatHistory(chat, systemPrompt, sendSSE);
    console.info(`Completed analysis of chat ${chat.id}`);
    sendSSE({ type: 'complete' });

    // Mark chat as processed
    await saveChat({
      ...chat,
      processed: true,
      processedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error analyzing chat:', error);
    // Send error through SSE before closing
    sendSSE({ 
      type: 'thinking',
      content: `Error analyzing chat: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    sendSSE({ type: 'complete' });
  }
});

// Strategic planning endpoint - integrates pin research into main chat system with chat persistence
router.post('/strategic-planning', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);
  
  // Create chat ID and tracking variables
  const chatId = `strategic-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let chatMessages: any[] = [];
  let chatTitle = '';
  let retryCount = 0;
  const maxRetries = 2;
  
  // Wrap sendSSE to capture messages for chat persistence
  const wrappedSendSSE = (data: any) => {
    // Capture messages for chat persistence
    if (data.type === 'response' && data.content) {
      chatMessages.push({
        role: 'answer',
        content: data.content,
        timestamp: new Date().toISOString()
      });
    }
    if (data.type === 'thinking' && data.content) {
      chatMessages.push({
        role: 'thinking',
        content: data.content,
        toolData: data.toolData,
        timestamp: new Date().toISOString()
      });
    }
    if (data.type === 'response' && data.suggestedTitle) {
      chatTitle = data.suggestedTitle;
    }
    
    // Forward to original sendSSE
    sendSSE(data);
  };
  
  const executeStrategicPlanning = async (): Promise<void> => {
    const { studentId, pinIds, pinNames } = req.body;
    
    if (!studentId || !pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      throw new Error('Student ID and pin IDs are required');
    }
    
    logger.info('Starting strategic planning', { studentId, pinIds, pinNames, attempt: retryCount + 1 });
    
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
      
      // Find source chat context if available (optional - manually added locations may not have this)
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
      
      // Always add the college to contexts, even without source chats
      collegeContexts.push(context);
    }
    
    logger.info('Starting strategic planning for colleges with context', { 
      colleges: collegeContexts.map(c => ({ name: c.name, hasContext: !!c.chatContext })) 
    });
    
    // Build enhanced strategic planning prompt with context
    let contextualPrompt = `I need you to create a comprehensive strategic application plan for the following college(s). Each college has been previously identified as a good fit for ${student.name}, and I'm providing you with the existing context and analysis.

`;
    
    // Add context for each college
    for (const context of collegeContexts) {
      contextualPrompt += `## ${context.name}\n`;
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
Now, building on this existing analysis, please create a detailed strategic application plan for ${student.name}. This should integrate strategic intelligence about college revenue optimization, digital behavior tactics, financial aid positioning, and athletic opportunities where relevant.

Focus on maximizing their chances of admission and financial aid to these specific colleges by:

1. **Strategic Research & Timeline**: Research current requirements and create a timeline that incorporates strategic timing (when to show interest, when to apply, optimal engagement windows)

2. **Financial Aid Optimization**: Develop strategies based on each college's aid model (need-based vs merit-based focus), including FAFSA timing and potential negotiation opportunities

3. **Digital Behavior Strategy**: Plan when and how to engage with colleges digitally to signal genuine interest without appearing desperate

4. **Athletic Integration**: If applicable, incorporate athletic outreach and recruitment strategies

5. **Access-Focused Approach**: Prioritize strategies that align with colleges' actual commitment to access vs revenue optimization

Use the available tools to research current information, create calendar items, and build actionable tasks that blend strategic intelligence with practical deadlines.

Provide a comprehensive plan that goes beyond just deadlines - create a strategic roadmap for success.`;
    
    // Add user message to chat
    chatMessages.push({
      role: 'user',
      content: contextualPrompt,
      timestamp: new Date().toISOString()
    });
    
    // Generate system prompt with plan creation tools and source chat context
    // Use the first source chat from the selected locations as the primary context
    let primarySourceChatId = null;
    let primarySourceChatTitle = null;
    
    // Find the first available source chat from the selected locations
    for (const context of collegeContexts) {
      if (context.sourceChats && context.sourceChats.length > 0) {
        const sourceChatId = context.sourceChats[0];
        const sourceChat = chats.find(chat => chat.id === sourceChatId);
        if (sourceChat) {
          primarySourceChatId = sourceChatId;
          primarySourceChatTitle = sourceChat.title;
          logger.info('Using source chat as context for strategic planning', { 
            sourceChatId, 
            sourceChatTitle: sourceChat.title,
            collegeName: context.name 
          });
          break; // Use the first valid source chat found
        }
      }
    }
    
    // If no source chat found, log warning but continue with current chat
    if (!primarySourceChatId) {
      logger.warn('No source chats found in selected map pins - strategic planning will use current chat context only');
      primarySourceChatId = chatId;
      primarySourceChatTitle = chatTitle || `Strategic Plan: ${req.body.pinNames?.join(', ') || 'Planning Session'}`;
    }
    
    const systemPrompt = await getBasePrompt(student.name, student, 'plan_building', req, {
      currentChatId: primarySourceChatId || undefined,
      currentChatTitle: primarySourceChatTitle || undefined,
      sourcePinIds: pinIds // Pass pin IDs to the AI context
    });
    
    // Create messages array for the strategic planning
    const messages = [
      {
        role: 'user' as const,
        content: contextualPrompt
      }
    ];
    
    // Process with AI service using the same iterative approach as other operations
    const aiService = await AIServiceFactory.createService(req.user.uid);
    logger.info('Starting strategic planning processing with AI service', { chatId, chatTitle });
    
    await aiService.processStream(messages, systemPrompt, wrappedSendSSE);
    
    logger.info('Strategic planning completed successfully');
  };
  
  try {
    await executeStrategicPlanning();
    
  } catch (error: any) {
    logger.error('Error in strategic planning:', error);
    
    // Check if this is a premature close error and we can retry
    if (error.message?.includes('Premature close') && retryCount < maxRetries) {
      retryCount++;
      logger.info(`Retrying strategic planning due to premature close (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Send retry notification to user
      wrappedSendSSE({ 
        type: 'thinking',
        content: `Connection interrupted, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`
      });
      
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        await executeStrategicPlanning();
      } catch (retryError: any) {
        logger.error('Retry failed:', retryError);
        // Send error through SSE before closing
        wrappedSendSSE({ 
          type: 'error',
          content: `Error during strategic planning (after ${retryCount + 1} attempts): ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
        });
      }
    } else {
      // Send error through SSE before closing
      wrappedSendSSE({ 
        type: 'error',
        content: `Error during strategic planning: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  } finally {
    // Always save the chat, even if there was an error
    try {
      const { studentId } = req.body;
      
      // Generate title if not set
      if (!chatTitle && req.body.pinNames) {
        chatTitle = `Strategic Plan: ${req.body.pinNames.join(', ')}`;
      }
      if (!chatTitle) {
        chatTitle = 'Strategic Planning Session';
      }
      
      // Clean up messages to remove undefined values that Firestore doesn't accept
      const cleanedMessages = chatMessages.map(msg => {
        const cleanedMsg: any = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        };
        
        // Only add toolData if it's defined and not empty
        if (msg.toolData && msg.toolData.trim() !== '') {
          cleanedMsg.toolData = msg.toolData;
        }
        
        return cleanedMsg;
      });
      
      // Create chat object
      const strategicPlanChat = {
        id: chatId,
        title: chatTitle,
        messages: cleanedMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studentId: studentId,
        type: 'strategic-planning', // Mark as strategic planning chat
        processed: true, // Mark as processed since it's already been through AI
        processedAt: new Date().toISOString()
      };
      
      // Save the chat
      await saveChat(strategicPlanChat);
      logger.info('Strategic planning chat saved', { chatId, title: chatTitle, messageCount: chatMessages.length });
      
      // Send chat info to frontend
      wrappedSendSSE({
        type: 'chat_saved',
        chatId: chatId,
        chatTitle: chatTitle,
        content: `Strategic planning session saved as chat: "${chatTitle}"`
      });
      
    } catch (saveError) {
      logger.error('Error saving strategic planning chat:', saveError);
    }
    
    // Send completion
    wrappedSendSSE({ type: 'complete' });
  }
});

export default router;
