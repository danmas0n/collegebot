import express, { Request, Response } from 'express';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all calendar items for a student
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    const calendarItemsRef = db.collection('calendar-items')
      .where('studentId', '==', studentId);
    
    const snapshot = await calendarItemsRef.get();
    
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error getting calendar items:', error);
    return res.status(500).json({ error: 'Failed to get calendar items' });
  }
});

// Create a new calendar item
router.post('/', async (req: Request, res: Response) => {
  try {
    const { item } = req.body;
    
    if (!item || !item.studentId || !item.title || !item.date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newItem = {
      id: uuidv4(),
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('calendar-items').doc(newItem.id).set(newItem);
    
    return res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating calendar item:', error);
    return res.status(500).json({ error: 'Failed to create calendar item' });
  }
});

// Update a calendar item
router.put('/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { updates } = req.body;
    
    if (!itemId || !updates) {
      return res.status(400).json({ error: 'Item ID and updates are required' });
    }
    
    const itemRef = db.collection('calendar-items').doc(itemId);
    const doc = await itemRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Calendar item not found' });
    }
    
    const updatedItem = {
      ...doc.data(),
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await itemRef.update(updatedItem);
    
    return res.status(200).json(updatedItem);
  } catch (error) {
    console.error('Error updating calendar item:', error);
    return res.status(500).json({ error: 'Failed to update calendar item' });
  }
});

// Delete a calendar item
router.delete('/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    
    const itemRef = db.collection('calendar-items').doc(itemId);
    const doc = await itemRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Calendar item not found' });
    }
    
    await itemRef.delete();
    
    return res.status(200).json({ message: 'Calendar item deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar item:', error);
    return res.status(500).json({ error: 'Failed to delete calendar item' });
  }
});

// Create calendar items from research findings
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
    
    // Extract deadlines from findings and create calendar items
    const calendarItems = [];
    
    for (const finding of request.findings || []) {
      if (finding.deadlines && finding.deadlines.length > 0) {
        for (const deadline of finding.deadlines) {
          const newItem = {
            id: uuidv4(),
            studentId: request.studentId,
            title: deadline.description,
            description: `Deadline for ${finding.pinId}. ${deadline.source ? `Source: ${deadline.source}` : ''}`,
            date: deadline.date,
            type: 'deadline',
            sourcePins: [finding.pinId],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await db.collection('calendar-items').doc(newItem.id).set(newItem);
          calendarItems.push(newItem);
        }
      }
    }
    
    return res.status(201).json({ 
      message: `Created ${calendarItems.length} calendar items from research`,
      items: calendarItems
    });
  } catch (error) {
    console.error('Error creating calendar items from research:', error);
    return res.status(500).json({ error: 'Failed to create calendar items from research' });
  }
});

export default router;
