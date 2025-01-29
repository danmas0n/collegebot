import express, { Request, Response } from 'express';
import { ClaudeService } from '../services/claude.js';
import { setupSSEResponse } from '../utils/helpers.js';
import { getBasePrompt } from '../prompts/base.js';
import { getChats, getStudent, saveChat } from '../services/firestore.js';
import { Chat } from '../types/firestore.js';
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();

// Handle individual messages
router.post('/message', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);
  
  try {
    const { message, studentData, studentName, history } = req.body;
    
    // Get API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['x-claude-api-key'];
    if (!apiKey) {
      throw new Error('API key header is required');
    }

    // Generate base prompt
    const systemPrompt = getBasePrompt();

    // Process message with Claude
    const claudeService = new ClaudeService(apiKey as string);
    await claudeService.processStream(history, systemPrompt, sendSSE);
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

// Analyze chat with Claude
router.post('/analyze', async (req: Request, res: Response) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);

  try {
    console.log('\nBackend - Starting chat analysis');
    const { studentId, chatId, mode } = req.body;
    console.log('Backend - Analysis request:', { studentId, chatId, mode });
    
    // Get API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['x-claude-api-key'];
    if (!apiKey) {
      console.error('Backend - Missing API key');
      throw new Error('API key header is required');
    }

    // Get the chat content
    console.log('Backend - Fetching chat content');
    const chats = await getChats(studentId);
    const chat = chats.find((c: Chat) => c.id === chatId);
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
    const systemPrompt = getBasePrompt();

    // Process chat with Claude
    const claudeService = new ClaudeService(apiKey as string);
    await claudeService.analyzeChatHistory(chat, systemPrompt, sendSSE);
    sendSSE({ type: 'complete' });

    // Mark chat as processed
    await saveChat({
      ...chat,
      processed: true,
      processedAt: Timestamp.now()
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
