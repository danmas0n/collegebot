import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString()
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Get student data
app.get('/api/student-data', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (userId) {
      // Get user-specific data
      const userDoc = await db.collection('students').doc(userId).get();
      if (userDoc.exists) {
        return res.json(userDoc.data());
      }
    }
    
    // Fall back to template data for anonymous users
    const templateDoc = await db.collection('templates').doc('student-data').get();
    if (templateDoc.exists) {
      return res.json(templateDoc.data().data);
    }

    res.status(404).json({ error: 'No student data found' });
  } catch (error) {
    console.error('Error getting student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student data
app.post('/api/student-data', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const data = req.body;
    await db.collection('students').doc(userId).set({
      data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ message: 'Student data updated successfully' });
  } catch (error) {
    console.error('Error updating student data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Student data server running on port ${port}`);
}); 