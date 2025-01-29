import express from 'express';
import { StudentData } from '../models/student-data.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const studentData = new StudentData();

// Get student data
router.get('/', authenticateUser, async (req, res) => {
  try {
    const data = await studentData.getStudentData(req.user.uid);
    if (!data) {
      return res.status(404).json({ error: 'No student data found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error getting student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student data
router.post('/', authenticateUser, async (req, res) => {
  try {
    const data = await studentData.updateStudentData(req.user.uid, req.body);
    res.json(data);
  } catch (error) {
    console.error('Error updating student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new student data
router.put('/', authenticateUser, async (req, res) => {
  try {
    const data = await studentData.createStudentData(req.user.uid, req.body);
    res.json(data);
  } catch (error) {
    console.error('Error creating student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete student data
router.delete('/', authenticateUser, async (req, res) => {
  try {
    await studentData.deleteStudentData(req.user.uid);
    res.json({ message: 'Student data deleted successfully' });
  } catch (error) {
    console.error('Error deleting student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 