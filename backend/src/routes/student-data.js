import express from 'express';
import { StudentData } from '../models/student-data.js';
import { authenticateUser } from '../middleware/auth.js';
import axios from 'axios';

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

// Geocode an address
router.post('/geocode', authenticateUser, async (req, res) => {
  try {
    const { address, name } = req.body;
    if (!address || !name) {
      return res.status(400).json({ error: 'Address and name are required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: apiKey
      }
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    res.json({
      name,
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: response.data.results[0].formatted_address
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({ error: error.message || 'Failed to geocode address' });
  }
});

export default router;
