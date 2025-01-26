import express from 'express';
import { ClaudeService } from '../services/claude.js';
import { executeMcpTool } from '../utils/mcp.js';
import { setupSSEResponse } from '../utils/helpers.js';
import { generateBasePrompt } from '../prompts/base.js';

const router = express.Router();

// Handle individual messages
router.post('/message', async (req, res) => {
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
    const systemPrompt = await generateBasePrompt(studentName, studentData);

    // Process message with Claude
    const claudeService = new ClaudeService(apiKey);
    await claudeService.processStream(history, systemPrompt, sendSSE);
    // Send complete event
    sendSSE({ type: 'complete' });
  } catch (error) {
    console.error('Error processing message:', error);
    // Send error through SSE before closing
    sendSSE({ 
      type: 'thinking',
      content: `Error processing message: ${error.message}`
    });
    sendSSE({ type: 'complete' });
  }
});

// Get all chats for a student
router.post('/chats', async (req, res) => {
  try {
    const { studentId } = req.body;
    const result = await executeMcpTool('student-data', 'get_chats', { studentId });
    try {
      const chats = JSON.parse(result.content[0].text);
      res.json({ chats });
    } catch {
      res.json({ text: result.content[0].text });
    }
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Analyze chat with Claude
router.post('/analyze', async (req, res) => {
  // Set up SSE response first so we can send errors through it
  const sendSSE = setupSSEResponse(res);

  try {
    console.log('\nBackend - Starting chat analysis');
    const { studentId, chatId, mode } = req.body;
    console.log('Backend - Analysis request:', { studentId, chatId, mode });
    
    // Get the chat content
    console.log('Backend - Fetching chat content');
    const result = await executeMcpTool('student-data', 'get_chats', { studentId });
    const chats = JSON.parse(result.content[0].text);
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) {
      throw new Error('Chat not found');
    }
    console.log('Backend - Found chat:', {
      id: chat.id,
      messageCount: chat.messages.length,
      messages: chat.messages.map(m => ({
        role: m.role,
        contentPreview: m.content ? m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '') : '[no content]'
      }))
    });

    // Get API key from headers
    const apiKey = req.headers['x-api-key'] || req.headers['x-claude-api-key'];
    if (!apiKey) {
      console.error('Backend - Missing API key');
      throw new Error('API key header is required');
    }
    console.log('Backend - API key present');

    // Get student data
    console.log('Backend - Fetching student data');
    const studentResult = await executeMcpTool('student-data', 'get_students', {});
    const students = JSON.parse(studentResult.content[0].text);
    const student = students.find(s => s.id === studentId);

    if (!student) {
      throw new Error('Student not found');
    }
    console.log('Backend - Found student:', {
      id: student.id,
      name: student.name
    });

    // Generate system prompt with graph enrichment mode
    console.log('Backend - Generating system prompt');
    const systemPrompt = await generateBasePrompt(student.name, student.data, mode);
    console.log('Backend - System prompt generated:', systemPrompt.slice(0, 200) + '...');


    // Process chat with Claude
    const claudeService = new ClaudeService(apiKey);
    await claudeService.analyzeChatHistory(chat, systemPrompt, sendSSE);
    sendSSE({ type: 'complete' });

    // Mark chat as processed
    const updatedChat = {
      ...chat,
      processed: true,
      processedAt: new Date().toISOString()
    };
    await executeMcpTool('student-data', 'save_chat', {
      studentId,
      chat: updatedChat
    });
  } catch (error) {
    console.error('Error analyzing chat:', error);
    // Send error through SSE before closing
    sendSSE({ 
      type: 'thinking',
      content: `Error analyzing chat: ${error.message}`
    });
    sendSSE({ type: 'complete' });
  }
});

// Mark all chats as processed
router.post('/mark-all-processed', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Get all chats for the student
    const result = await executeMcpTool('student-data', 'get_chats', { studentId });
    const chats = JSON.parse(result.content[0].text);

    // Mark each chat as processed
    for (const chat of chats) {
      const updatedChat = {
        ...chat,
        processed: true,
        processedAt: new Date().toISOString()
      };
      await executeMcpTool('student-data', 'save_chat', { 
        studentId,
        chat: updatedChat
      });
    }

    res.json({ message: 'All chats marked as processed' });
  } catch (error) {
    console.error('Error marking chats as processed:', error);
    res.status(500).json({ error: 'Failed to mark chats as processed' });
  }
});

// Mark all chats as unprocessed
router.post('/mark-all-unprocessed', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Get all chats for the student
    const result = await executeMcpTool('student-data', 'get_chats', { studentId });
    const chats = JSON.parse(result.content[0].text);

    // Mark each chat as unprocessed
    for (const chat of chats) {
      const updatedChat = {
        ...chat,
        processed: false,
        processedAt: null
      };
      await executeMcpTool('student-data', 'save_chat', { 
        studentId,
        chat: updatedChat
      });
    }

    res.json({ message: 'All chats marked as unprocessed' });
  } catch (error) {
    console.error('Error marking chats as unprocessed:', error);
    res.status(500).json({ error: 'Failed to mark chats as unprocessed' });
  }
});

// Save chat
router.post('/chat', async (req, res) => {
  try {
    const { studentId, chat } = req.body;
    await executeMcpTool('student-data', 'save_chat', { studentId, chat });
    res.json({ message: 'Chat saved successfully' });
  } catch (error) {
    console.error('Error saving chat:', error);
    res.status(500).json({ error: 'Failed to save chat' });
  }
});

// Delete chat
router.delete('/chat', async (req, res) => {
  try {
    const { studentId, chatId } = req.body;
    await executeMcpTool('student-data', 'delete_chat', { studentId, chatId });
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
