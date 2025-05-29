import express from 'express';
import { db } from '../config/firebase';
import { authenticateUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Plan interface matching frontend
interface Plan {
  id: string;
  studentId: string;
  schoolId: string | 'general';
  schoolName: string | 'General';
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  sourceChats: string[];
  lastModified: Date;
  description?: string;
  timeline: PlanItem[];
}

interface PlanItem {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  category: 'application' | 'testing' | 'scholarship' | 'visit' | 'financial' | 'other';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  schoolSpecific: boolean;
  relatedSchools: string[];
  sourceChat?: string;
}

// Get all plans for a student
router.get('/:studentId', authenticateUser, async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify student ownership
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plansSnapshot = await db
      .collection('plans')
      .where('studentId', '==', studentId)
      .orderBy('updatedAt', 'desc')
      .get();

    const plans = plansSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastModified: doc.data().lastModified?.toDate(),
      timeline: doc.data().timeline?.map((item: any) => ({
        ...item,
        dueDate: item.dueDate?.toDate()
      })) || []
    }));

    res.json(plans);
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create a new plan
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { studentId, schoolId, schoolName, description } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify student ownership
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    const planData = {
      studentId,
      schoolId: schoolId || 'general',
      schoolName: schoolName || 'General',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      lastModified: now,
      sourceChats: [],
      description: description || '',
      timeline: []
    };

    const planRef = await db.collection('plans').add(planData);
    
    const plan = {
      id: planRef.id,
      ...planData
    };

    logger.info(`Plan created: ${planRef.id} for student ${studentId}`);
    res.status(201).json(plan);
  } catch (error) {
    logger.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// AI Plan Builder endpoint with streaming
router.post('/build-plan', authenticateUser, async (req, res) => {
  // Set up SSE response
  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    const { planId, message, context } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      sendSSE({ type: 'error', content: 'User not authenticated' });
      sendSSE({ type: 'complete' });
      return;
    }

    // Verify plan ownership
    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) {
      sendSSE({ type: 'error', content: 'Plan not found' });
      sendSSE({ type: 'complete' });
      return;
    }

    const planData = planDoc.data();
    const studentDoc = await db.collection('students').doc(planData?.studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      sendSSE({ type: 'error', content: 'Access denied' });
      sendSSE({ type: 'complete' });
      return;
    }

    const student = studentDoc.data();
    if (!student) {
      sendSSE({ type: 'error', content: 'Student data not found' });
      sendSSE({ type: 'complete' });
      return;
    }

    // Get AI service
    const { AIServiceFactory } = await import('../services/ai-service-factory.js');
    const aiService = await AIServiceFactory.createService(userId);

    // Generate system prompt for plan building
    const { getBasePrompt } = await import('../prompts/base.js');
    const systemPrompt = await getBasePrompt(student.name, student, 'plan_building', req);

    // Build conversation history with plan context
    const planContext = `Current Plan Context:
- School: ${context.plan.schoolName}
- Plan ID: ${planId}
- Student: ${student.name}
- Current Timeline Items: ${context.plan.timeline?.length || 0}

Plan Details:
${JSON.stringify(context.plan, null, 2)}

Student Profile:
${JSON.stringify(context.studentProfile || {}, null, 2)}

Budget Information:
${JSON.stringify(context.budgetInfo || {}, null, 2)}`;

    const conversationHistory = context.conversationHistory || [];
    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: `${planContext}\n\nUser Message: ${message}`
      }
    ];

    // Process with AI service using streaming
    await aiService.processStream(messages, systemPrompt, sendSSE);

  } catch (error) {
    logger.error('Error in AI plan builder:', error);
    sendSSE({ type: 'error', content: 'Failed to generate plan' });
    sendSSE({ type: 'complete' });
  }
});

// Get a specific plan
router.get('/plan/:planId', authenticateUser, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planData = planDoc.data();
    
    // Verify student ownership
    const studentDoc = await db.collection('students').doc(planData?.studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan = {
      id: planDoc.id,
      ...planData,
      createdAt: planData?.createdAt?.toDate(),
      updatedAt: planData?.updatedAt?.toDate(),
      lastModified: planData?.lastModified?.toDate(),
      timeline: planData?.timeline?.map((item: any) => ({
        ...item,
        dueDate: item.dueDate?.toDate()
      })) || []
    };

    res.json(plan);
  } catch (error) {
    logger.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// Update a plan
router.put('/:planId', authenticateUser, async (req, res) => {
  try {
    const { planId } = req.params;
    const updates = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planData = planDoc.data();
    
    // Verify student ownership
    const studentDoc = await db.collection('students').doc(planData?.studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    const updateData = {
      ...updates,
      updatedAt: now,
      lastModified: now,
      // Convert timeline dates if provided
      timeline: updates.timeline?.map((item: any) => ({
        ...item,
        dueDate: item.dueDate ? new Date(item.dueDate) : item.dueDate
      }))
    };

    await db.collection('plans').doc(planId).update(updateData);

    logger.info(`Plan updated: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete a plan
router.delete('/:planId', authenticateUser, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planData = planDoc.data();
    
    // Verify student ownership
    const studentDoc = await db.collection('students').doc(planData?.studentId).get();
    if (!studentDoc.exists || studentDoc.data()?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.collection('plans').doc(planId).delete();

    logger.info(`Plan deleted: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

export default router;
