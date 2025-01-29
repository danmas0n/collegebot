import express from 'express';
import { executeMcpTool } from '../utils/mcp.js';

const router = express.Router();

// Debug logging for route registration
console.log('Registering student routes...');
console.log('Available routes:');

// Get all students
router.get('/', async (req, res) => {
  try {
    const result = await executeMcpTool('student-data', 'get_students', {});
    try {
      const students = JSON.parse(result.content[0].text);
      res.json(students);
    } catch {
      res.json({ text: result.content[0].text });
    }
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

// Map location routes
router.post('/map-locations/get', async (req, res) => {
  console.log('POST /map-locations/get route hit');
  console.log('Request body:', req.body);
  console.log('Full URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  try {
    const { studentId } = req.body;
    if (!studentId) {
      console.log('No studentId provided in request body');
      return res.status(400).json({ error: 'Student ID is required' });
    }
    console.log('Getting locations for student:', studentId);
    const result = await executeMcpTool('student-data', 'get_map_locations', { studentId });
    const locations = JSON.parse(result.content[0].text);
    res.json(locations);
  } catch (error) {
    console.error('Error in map locations route handler:', error);
    res.status(500).json({ error: 'Failed to get map locations' });
  }
});

router.post('/map-locations', async (req, res) => {
  try {
    const { studentId, ...location } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    await executeMcpTool('student-data', 'add_map_location', { studentId, location });
    
    // Return the updated list of locations
    const result = await executeMcpTool('student-data', 'get_map_locations', { studentId });
    const locations = JSON.parse(result.content[0].text);
    res.json(locations);
  } catch (error) {
    console.error('Error adding map location:', error);
    res.status(500).json({ error: 'Failed to add map location' });
  }
});

router.post('/map-locations/delete', async (req, res) => {
  try {
    const { studentId, locationId } = req.body;
    if (!studentId || !locationId) {
      return res.status(400).json({ error: 'Student ID and Location ID are required' });
    }
    await executeMcpTool('student-data', 'delete_map_location', { studentId, locationId });
    res.json({ message: 'Map location deleted successfully' });
  } catch (error) {
    console.error('Error deleting map location:', error);
    res.status(500).json({ error: 'Failed to delete map location' });
  }
});

// Save student
router.post('/', async (req, res) => {
  try {
    const { student } = req.body;
    await executeMcpTool('student-data', 'save_student', { student });
    res.json({ message: 'Student saved successfully' });
  } catch (error) {
    console.error('Error saving student:', error);
    res.status(500).json({ error: 'Failed to save student' });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await executeMcpTool('student-data', 'delete_student', { id });
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Mark chat as processed
router.post('/mark-chat-processed', async (req, res) => {
  try {
    const { studentId, chatId, lastMessageTimestamp } = req.body;
    const result = await executeMcpTool('student-data', 'mark_chat_processed', {
      studentId,
      chatId,
      lastMessageTimestamp
    });
    res.json({ message: 'Chat marked as processed' });
  } catch (error) {
    console.error('Error marking chat as processed:', error);
    res.status(500).json({ error: 'Failed to mark chat as processed' });
  }
});

// Clear map locations
router.post('/clear-map-locations', async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    await executeMcpTool('student-data', 'clear_map_locations', { studentId });
    res.json({ message: 'Map locations cleared successfully' });
  } catch (error) {
    console.error('Error clearing map locations:', error);
    res.status(500).json({ error: 'Failed to clear map locations' });
  }
});

export default router;
