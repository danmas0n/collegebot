import express, { Request, Response } from 'express';
import { db } from '../config/firebase';
import { ResearchTask, ResearchFinding } from '../types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();

// Get all research tasks for a student
router.get('/tasks/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const snapshot = await db.collection('research_tasks')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ tasks });
  } catch (error) {
    console.error('Error getting research tasks:', error);
    res.status(500).json({ error: 'Failed to get research tasks' });
  }
});

// Create a new research task
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { task } = req.body;
    const docRef = await db.collection('research_tasks').add({
      ...task,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const newTask = await docRef.get();
    res.json({
      id: docRef.id,
      ...newTask.data()
    });
  } catch (error) {
    console.error('Error creating research task:', error);
    res.status(500).json({ error: 'Failed to create research task' });
  }
});

// Update a research task
router.put('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { updates } = req.body;

    const taskRef = db.collection('research_tasks').doc(taskId);
    const task = await taskRef.get();

    if (!task.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await taskRef.update({
      ...updates,
      updatedAt: Timestamp.now()
    });

    const updatedTask = await taskRef.get();
    res.json({
      id: taskId,
      ...updatedTask.data()
    });
  } catch (error) {
    console.error('Error updating research task:', error);
    res.status(500).json({ error: 'Failed to update research task' });
  }
});

// Add a finding to a research task
router.post('/tasks/:taskId/findings', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { finding } = req.body;

    const taskRef = db.collection('research_tasks').doc(taskId);
    const task = await taskRef.get();

    if (!task.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const newFinding: ResearchFinding = {
      ...finding,
      timestamp: Timestamp.now()
    };

    const taskData = task.data() as ResearchTask;
    await taskRef.update({
      findings: [...(taskData.findings || []), newFinding],
      updatedAt: Timestamp.now()
    });

    const updatedTask = await taskRef.get();
    res.json({
      id: taskId,
      ...updatedTask.data()
    });
  } catch (error) {
    console.error('Error adding research finding:', error);
    res.status(500).json({ error: 'Failed to add research finding' });
  }
});

// Delete a research task
router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    await db.collection('research_tasks').doc(taskId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting research task:', error);
    res.status(500).json({ error: 'Failed to delete research task' });
  }
});

// Delete all research tasks for a student
router.delete('/tasks/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const batch = db.batch();

    const snapshot = await db.collection('research_tasks')
      .where('studentId', '==', studentId)
      .get();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting research tasks:', error);
    res.status(500).json({ error: 'Failed to delete research tasks' });
  }
});

export default router;
