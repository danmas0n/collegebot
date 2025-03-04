import express, { Request, Response } from 'express';
import { db } from '../config/firebase';
import { Task } from '../types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

const router = express.Router();

// Get all tasks for a student
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const snapshot = await db.collection('tasks')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Create a new task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { task } = req.body;
    const docRef = await db.collection('tasks').add({
      ...task,
      completed: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const newTask = await docRef.get();
    res.json({
      id: docRef.id,
      ...newTask.data()
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
router.put('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { updates } = req.body;

    const taskRef = db.collection('tasks').doc(taskId);
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
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    await db.collection('tasks').doc(taskId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Delete all tasks for a student
router.delete('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const batch = db.batch();

    const snapshot = await db.collection('tasks')
      .where('studentId', '==', studentId)
      .get();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tasks:', error);
    res.status(500).json({ error: 'Failed to delete tasks' });
  }
});

// Create tasks from research findings
router.post('/from-findings', async (req: Request, res: Response) => {
  try {
    const { studentId, findings } = req.body;
    const batch = db.batch();
    const newTasks: Task[] = [];

    for (const finding of findings) {
      if (finding.category === 'deadline') {
        const taskRef = db.collection('tasks').doc();
        const task: Task = {
          id: taskRef.id,
          studentId,
          title: finding.detail,
          description: `Auto-generated from research finding for ${finding.entityName}`,
          dueDate: extractDate(finding.detail),
          completed: false,
          category: finding.entityType === 'college' ? 'application' : 'scholarship',
          relatedEntities: {
            collegeIds: finding.entityType === 'college' ? [finding.entityId] : [],
            scholarshipIds: finding.entityType === 'scholarship' ? [finding.entityId] : []
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        batch.set(taskRef, task);
        newTasks.push(task);
      }
    }

    await batch.commit();
    res.json({ tasks: newTasks });
  } catch (error) {
    console.error('Error creating tasks from findings:', error);
    res.status(500).json({ error: 'Failed to create tasks from findings' });
  }
});

// Helper function to extract date from a string
const extractDate = (text: string): string => {
  const dateRegex = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi;
  const match = text.match(dateRegex);
  if (match) {
    try {
      const date = new Date(match[0]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }
  return '';
};

export default router;
