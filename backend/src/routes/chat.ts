import express, { Request, Response } from 'express';
import { AIServiceFactory } from '../services/ai-service-factory.js';
import { setupSSEResponse } from '../utils/helpers.js';
import { getBasePrompt } from '../prompts/base.js';
import { getChats, getStudent, saveChat, deleteChat } from '../services/firestore.js';
import { Chat, ChatDTO, DTOChatMessage, FirestoreChatMessage } from '../types/firestore.js';
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();

// Handle individual messages
router.post('/message', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);
  
  try {
    const { message, studentData, studentName, history } = req.body;
    
    // Generate base prompt
    const systemPrompt = await getBasePrompt(studentName, studentData);

    // Process message with service
    const aiService = await AIServiceFactory.createService(req.user.uid);
    await aiService.processStream(history, systemPrompt, sendSSE);
    // Send complete event
    sendSSE({ type: 'complete' });
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
    
    // Save the chat
    await saveChat(chat);
    console.log('Backend - Chat saved successfully');

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
    const chats = await getChats(studentId);
    const unprocessedChats = chats.filter(chat => !chat.processed);
    
    if (unprocessedChats.length === 0) {
      sendSSE({ type: 'complete' });
      return;
    }

    // Send total count for progress tracking
    sendSSE({ 
      type: 'status',
      content: `Processing ${unprocessedChats.length} chats...`,
      total: unprocessedChats.length
    });
    
    // Generate system prompt
    const systemPrompt = await getBasePrompt(student.name, student, 'map_enrichment', req);

    // Process each chat
    const aiService = await AIServiceFactory.createService(req.user.uid);
    let processed = 0;

    for (const chat of unprocessedChats) {
      try {
        sendSSE({ 
          type: 'status',
          content: `Processing chat: ${chat.title || chat.id}`,
          progress: processed + 1,
          total: unprocessedChats.length
        });

    console.info(`Starting analysis of chat ${chat.id}: ${chat.title || 'Untitled Chat'}`);
    await aiService.analyzeChatHistory(chat, systemPrompt, (update) => {
      sendSSE({
        type: 'thinking',
        content: update
      });
    });

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

    // Generate system prompt
    console.log('Backend - Generating system prompt');
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
