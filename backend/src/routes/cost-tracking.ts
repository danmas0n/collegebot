import express from 'express';
import { flowCostTracker } from '../services/flow-cost-tracker.js';
import { costCalculator } from '../services/cost-calculator.js';
import { db } from '../config/firebase.js';
import { LLMPricingConfig } from '../types/firestore.js';
import { logger } from '../utils/logger.js';
import { auth } from '../config/firebase.js';

const router = express.Router();

/**
 * Helper function to resolve user email from Firebase Auth
 */
async function getUserEmail(userId: string): Promise<string> {
  try {
    const userRecord = await auth.getUser(userId);
    return userRecord.email || userId; // Fallback to userId if no email
  } catch (error: any) {
    logger.warn('Could not resolve user email', { userId, error: error.message });
    return userId; // Fallback to userId if user not found
  }
}

/**
 * Helper function to normalize Firestore timestamps to JavaScript dates
 */
function normalizeDate(firestoreDate: any): Date | null {
  if (!firestoreDate) return null;
  
  // If it's already a Date object, return it
  if (firestoreDate instanceof Date) {
    return firestoreDate;
  }
  
  // If it's a Firestore Timestamp, convert it
  if (firestoreDate && typeof firestoreDate.toDate === 'function') {
    return firestoreDate.toDate();
  }
  
  // If it's a string or number, try to parse it
  if (typeof firestoreDate === 'string' || typeof firestoreDate === 'number') {
    const parsed = new Date(firestoreDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  return null;
}

/**
 * Helper function to normalize flow data for frontend consumption
 */
function normalizeFlowData(flow: any): any {
  return {
    ...flow,
    createdAt: normalizeDate(flow.createdAt),
    completedAt: normalizeDate(flow.completedAt),
    startedAt: normalizeDate(flow.startedAt),
    // Ensure numeric fields are properly typed
    totalInputTokens: Number(flow.totalInputTokens) || 0,
    totalOutputTokens: Number(flow.totalOutputTokens) || 0,
    totalCacheCreationTokens: Number(flow.totalCacheCreationTokens) || 0,
    totalCacheReadTokens: Number(flow.totalCacheReadTokens) || 0,
    totalEstimatedCost: Number(flow.totalEstimatedCost) || 0,
    totalRequests: Number(flow.totalRequests) || 0
  };
}

/**
 * Get cost summary for all users (admin only)
 */
router.get('/users/summary', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    
    // Get all flow costs grouped by user
    const snapshot = await db.collection('llm_flow_costs').get();
    const userSummaries: { [userId: string]: any } = {};

    for (const doc of snapshot.docs) {
      const flow = doc.data();
      const userId = flow.userId;
      
      if (!userSummaries[userId]) {
        userSummaries[userId] = {
          userId,
          totalCost: 0,
          totalFlows: 0,
          lastActivity: null,
          stageBreakdown: {}
        };
      }

      userSummaries[userId].totalCost += flow.totalEstimatedCost || 0;
      userSummaries[userId].totalFlows += 1;
      
      // Track last activity
      const completedAt = flow.completedAt?.toDate() || flow.createdAt?.toDate();
      if (!userSummaries[userId].lastActivity || completedAt > userSummaries[userId].lastActivity) {
        userSummaries[userId].lastActivity = completedAt;
      }

      // Stage breakdown
      const stage = flow.stage;
      if (!userSummaries[userId].stageBreakdown[stage]) {
        userSummaries[userId].stageBreakdown[stage] = { cost: 0, flows: 0 };
      }
      userSummaries[userId].stageBreakdown[stage].cost += flow.totalEstimatedCost || 0;
      userSummaries[userId].stageBreakdown[stage].flows += 1;
    }

    // Convert to array and add average cost per flow, then resolve user emails
    const summaries = Object.values(userSummaries).map((summary: any) => ({
      ...summary,
      averageCostPerFlow: summary.totalFlows > 0 ? summary.totalCost / summary.totalFlows : 0
    }));

    // Resolve user emails for all users
    const summariesWithEmails = await Promise.all(
      summaries.map(async (summary: any) => ({
        ...summary,
        userEmail: await getUserEmail(summary.userId)
      }))
    );

    res.json(summariesWithEmails);
  } catch (error) {
    logger.error('Error getting user cost summaries', { error });
    res.status(500).json({ error: 'Failed to get user cost summaries' });
  }
});

/**
 * Get all flows for a specific user
 */
router.get('/user/:userId/flows', async (req, res) => {
  try {
    const { userId } = req.params;
    const flows = await flowCostTracker.getUserFlowCosts(userId);
    
    // Transform and normalize Firestore data to frontend-expected format
    const transformedFlows = flows.map((flow: any) => {
      const normalized = normalizeFlowData(flow);
      return {
        id: normalized.id,
        userId: normalized.userId,
        stage: normalized.stage,
        chatId: normalized.chatId,
        chatTitle: 'Untitled', // TODO: Get actual chat title from chats collection
        createdAt: normalized.createdAt,
        completedAt: normalized.completedAt,
        totalInputTokens: normalized.totalInputTokens,
        totalOutputTokens: normalized.totalOutputTokens,
        totalCacheCreationInputTokens: normalized.totalCacheCreationTokens,
        totalCacheReadInputTokens: normalized.totalCacheReadTokens,
        totalEstimatedCost: normalized.totalEstimatedCost,
        requestCount: normalized.totalRequests,
        isCompleted: !!normalized.completedAt
      };
    });
    
    res.json(transformedFlows);
  } catch (error) {
    logger.error('Error getting user flows', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to get user flows' });
  }
});

/**
 * Get cost breakdown by stage for a specific user
 */
router.get('/user/:userId/breakdown', async (req, res) => {
  try {
    const { userId } = req.params;
    const breakdown = await flowCostTracker.getUserFlowCostsByStage(userId);
    res.json(breakdown);
  } catch (error) {
    logger.error('Error getting user cost breakdown', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to get user cost breakdown' });
  }
});

/**
 * Get cost summary for a specific user
 */
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const summary = await flowCostTracker.getUserCostSummary(userId);
    res.json(summary);
  } catch (error) {
    logger.error('Error getting user cost summary', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to get user cost summary' });
  }
});

/**
 * Get detailed cost information for a specific flow
 */
router.get('/flow/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const flowCost = await flowCostTracker.getFlowCost(chatId);
    
    if (!flowCost) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    // Get request logs for this flow
    const requestLogs = await flowCostTracker.getFlowRequestLogs(flowCost.id);

    res.json({
      flow: flowCost,
      requests: requestLogs
    });
  } catch (error) {
    logger.error('Error getting flow cost details', { error, chatId: req.params.chatId });
    res.status(500).json({ error: 'Failed to get flow cost details' });
  }
});

/**
 * Get current pricing configuration (admin only)
 */
router.get('/admin/pricing', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    
    const snapshot = await db.collection('llm_pricing_config').get();
    const pricingConfigs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Transform and resolve user emails for updatedBy fields
    const configsWithEmails = await Promise.all(
      pricingConfigs.map(async (config: any) => ({
        id: config.id,
        provider: config.provider,
        model: config.model,
        pricing: {
          inputTokensPerMillion: config.pricing?.input || 0,
          outputTokensPerMillion: config.pricing?.output || 0,
          cacheCreationInputTokensPerMillion: config.pricing?.cacheCreation || 0,
          cacheReadInputTokensPerMillion: config.pricing?.cacheRead || 0
        },
        updatedAt: config.updatedAt && config.updatedAt.toDate ? config.updatedAt.toDate() : new Date(),
        updatedBy: config.updatedBy,
        updatedByEmail: config.updatedBy ? await getUserEmail(config.updatedBy) : 'Unknown'
      }))
    );

    res.json(configsWithEmails);
  } catch (error) {
    logger.error('Error getting pricing configuration', { error });
    res.status(500).json({ error: 'Failed to get pricing configuration' });
  }
});

/**
 * Update pricing configuration (admin only)
 */
router.put('/admin/pricing', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'Configs must be an array' });
    }

    const batch = db.batch();
    
    for (const config of configs) {
      const { id, provider, model, pricing } = config;
      
      if (!provider || !model || !pricing) {
        return res.status(400).json({ error: 'Missing required fields: provider, model, pricing' });
      }

      const docRef = id ? db.collection('llm_pricing_config').doc(id) : db.collection('llm_pricing_config').doc();
      
      // Transform frontend pricing format to backend format
      const backendPricing = {
        input: pricing.inputTokensPerMillion || 0,
        output: pricing.outputTokensPerMillion || 0,
        cacheCreation: pricing.cacheCreationInputTokensPerMillion || 0,
        cacheRead: pricing.cacheReadInputTokensPerMillion || 0
      };
      
      const pricingConfig: Omit<LLMPricingConfig, 'id'> = {
        provider,
        model,
        pricing: backendPricing,
        updatedAt: new Date() as any,
        updatedBy: req.user?.uid || 'admin' // TODO: Get from authenticated user
      };

      batch.set(docRef, pricingConfig);
    }

    await batch.commit();
    
    // Clear pricing cache to force reload
    costCalculator.clearCache();
    
    logger.info('Updated pricing configuration', { configCount: configs.length });
    res.json({ success: true, message: `Updated ${configs.length} pricing configurations` });
  } catch (error) {
    logger.error('Error updating pricing configuration', { error });
    res.status(500).json({ error: 'Failed to update pricing configuration' });
  }
});

/**
 * Initialize default pricing configurations (admin only)
 */
router.post('/admin/pricing/initialize', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    
    await costCalculator.initializeDefaultPricing();
    res.json({ success: true, message: 'Default pricing configurations initialized' });
  } catch (error) {
    logger.error('Error initializing default pricing', { error });
    res.status(500).json({ error: 'Failed to initialize default pricing' });
  }
});

/**
 * Complete a flow (mark as finished)
 */
router.post('/flow/:chatId/complete', async (req, res) => {
  try {
    const { chatId } = req.params;
    await flowCostTracker.completeFlow(chatId);
    res.json({ success: true, message: 'Flow completed' });
  } catch (error) {
    logger.error('Error completing flow', { error, chatId: req.params.chatId });
    res.status(500).json({ error: 'Failed to complete flow' });
  }
});

export default router;
