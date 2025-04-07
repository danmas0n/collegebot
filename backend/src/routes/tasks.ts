import express, { Request, Response } from 'express';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all tasks for a student
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    const tasksRef = db.collection('tasks')
      .where('studentId', '==', studentId);
    
    const snapshot = await tasksRef.get();
    
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error getting tasks:', error);
    return res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Create a new task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { task } = req.body;
    
    if (!task || !task.studentId || !task.title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newTask = {
      id: uuidv4(),
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('tasks').doc(newTask.id).set(newTask);
    
    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task
router.put('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { updates } = req.body;
    
    if (!taskId || !updates) {
      return res.status(400).json({ error: 'Task ID and updates are required' });
    }
    
    const taskRef = db.collection('tasks').doc(taskId);
    const doc = await taskRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const updatedTask = {
      ...doc.data(),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await taskRef.update(updatedTask);
    
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    const taskRef = db.collection('tasks').doc(taskId);
    const doc = await taskRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await taskRef.delete();
    
    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Create tasks from research findings
router.post('/from-research/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId) {
      return res.status(400).json({ error: 'Research request ID is required' });
    }
    
    // Get the research request
    const requestRef = db.collection('pin-research-requests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Research request not found' });
    }
    
    const request = requestDoc.data();
    
    if (!request) {
      return res.status(404).json({ error: 'Research request data not found' });
    }
    
    // Extract requirements from findings and create tasks
    const tasks = [];
    
    for (const finding of request.findings || []) {
      if (finding.requirements && finding.requirements.length > 0) {
        for (const requirement of finding.requirements) {
          const newTask = {
            id: uuidv4(),
            studentId: request.studentId,
            title: requirement.description,
            description: `Requirement for ${finding.pinId}. ${requirement.source ? `Source: ${requirement.source}` : ''}`,
            dueDate: null, // No due date for requirements by default
            completed: false,
            category: 'application',
            sourcePins: [finding.pinId],
            priority: 'medium',
            tags: ['requirement'],
            reminderDates: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('tasks').doc(newTask.id).set(newTask);
          tasks.push(newTask);
        }
      }
      
      // Also create tasks for deadlines
      if (finding.deadlines && finding.deadlines.length > 0) {
        for (const deadline of finding.deadlines) {
          const newTask = {
            id: uuidv4(),
            studentId: request.studentId,
            title: deadline.description,
            description: `Deadline for ${finding.pinId}. ${deadline.source ? `Source: ${deadline.source}` : ''}`,
            dueDate: deadline.date,
            completed: false,
            category: 'deadline',
            sourcePins: [finding.pinId],
            priority: 'high',
            tags: ['deadline'],
            reminderDates: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('tasks').doc(newTask.id).set(newTask);
          tasks.push(newTask);
        }
      }
    }
    
    return res.status(201).json({ 
      message: `Created ${tasks.length} tasks from research`,
      tasks
    });
  } catch (error) {
    console.error('Error creating tasks from research:', error);
    return res.status(500).json({ error: 'Failed to create tasks from research' });
  }
});

export default router;
