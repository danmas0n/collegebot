import express, { Request, Response } from 'express';
import { AIServiceFactory } from '../services/ai-service-factory.js';
import { setupSSEResponse, filterChatMessages } from '../utils/helpers.js';
import { getBasePrompt } from '../prompts/base.js';
import { getChats, getStudent, saveChat, deleteChat } from '../services/firestore.js';
import { Chat, ChatDTO, DTOChatMessage, FirestoreChatMessage } from '../types/firestore.js';
import { Timestamp } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';

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

    // Send total count for progress tracking
    sendSSE({ 
      type: 'status',
      content: `Processing ${unprocessedChats.length} chats...`,
      total: unprocessedChats.length
    });
    
    // Process each chat with fresh system prompt (includes current map locations)
    const aiService = await AIServiceFactory.createService(req.user.uid);
    let processed = 0;

    for (const chat of unprocessedChats) {
      try {
        sendSSE({ 
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

        console.info(`Starting analysis of chat ${chat.id}: ${chat.title || 'Untitled Chat'}`);
        // FIXED: Pass sendSSE directly instead of wrapping it
        await aiService.analyzeChatHistory(chat, systemPrompt, sendSSE);

        // Research task processing has been removed

        await saveChat({
          ...chat,
          processed: true,
          processedAt: new Date().toISOString()
        });

        processed++;
      } catch (error) {
        console.error(`Error processing chat ${chat.id}:`, error);
        sendSSE({
          type: 'error',
          content: `Error processing chat: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    sendSSE({ type: 'complete' });
  } catch (error) {
    console.error('Error processing all chats:', error);
    res.status(500).json({ error: 'Failed to process chats' });
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

export default router;
