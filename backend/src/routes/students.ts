import express from 'express';
import { 
  getStudents, 
  getStudent,
  saveStudent,
  deleteStudent,
  getMapLocations,
  addMapLocation,
  deleteMapLocation,
  clearMapLocations
} from '../services/firestore';

const router = express.Router();

// Debug logging for route registration
console.log('Registering student routes...');
console.log('Available routes:');

// Get all students
router.get('/', async (req, res) => {
  console.log('GET / route hit');
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const students = await getStudents(userId);
    res.json(students);
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

// Map location routes - moved before the general student routes to be more specific
router.post('/map-locations/get', async (req, res) => {
  console.log('POST /map-locations/get route hit');
  console.log('Request body:', req.body);
  console.log('Full URL:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const { studentId } = req.body;
    if (!studentId) {
      console.log('No studentId provided in request body');
      return res.status(400).json({ error: 'Student ID is required' });
    }
    console.log('Getting locations for student:', studentId);
    const locations = await getMapLocations(studentId, userId);
    res.json(locations);
  } catch (error) {
    console.error('Error in map locations route handler:', error);
    res.status(500).json({ error: 'Failed to get map locations' });
  }
});

router.post('/map-locations', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const { studentId, ...location } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    await addMapLocation({ ...location, studentId }, userId);
    
    // Return the updated list of locations
    const locations = await getMapLocations(studentId, userId);
    res.json(locations);
  } catch (error) {
    console.error('Error adding map location:', error);
    res.status(500).json({ error: 'Failed to add map location' });
  }
});

router.post('/map-locations/delete', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const { studentId, locationId } = req.body;
    if (!studentId || !locationId) {
      return res.status(400).json({ error: 'Student ID and Location ID are required' });
    }
    await deleteMapLocation(studentId, locationId, userId);
    res.json({ message: 'Map location deleted successfully' });
  } catch (error) {
    console.error('Error deleting map location:', error);
    res.status(500).json({ error: 'Failed to delete map location' });
  }
});

router.post('/map-locations/clear', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    await clearMapLocations(studentId, userId);
    res.json({ message: 'Map locations cleared successfully' });
  } catch (error) {
    console.error('Error clearing map locations:', error);
    res.status(500).json({ error: 'Failed to clear map locations' });
  }
});

// Get a single student
router.get('/:id', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const student = await getStudent(req.params.id, userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json(student);
  } catch (error) {
    console.error('Error getting student:', error);
    res.status(500).json({ error: 'Failed to get student' });
  }
});

// Save student
router.post('/:id', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    const student = {
      ...req.body,
      id: req.params.id
    };
    await saveStudent(student, userId);
    res.json({ message: 'Student saved successfully' });
  } catch (error) {
    console.error('Error saving student:', error);
    res.status(500).json({ error: 'Failed to save student' });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    // @ts-ignore - user is added by middleware
    const userId = req.user.uid;
    await deleteStudent(req.params.id, userId);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

export default router;
