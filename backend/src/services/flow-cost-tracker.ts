import { db } from '../config/firebase.js';
import { LLMFlowCost, LLMRequestLog } from '../types/firestore.js';
import { costCalculator, TokenUsage, CostBreakdown } from './cost-calculator.js';
import { logger } from '../utils/logger.js';

export interface FlowCostUpdate {
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
  usage: TokenUsage;
  requestSequence: number;
}

export class FlowCostTracker {
  private activeFlows: Map<string, string> = new Map(); // chatId -> flowCostId

  /**
   * Start tracking a new flow
   */
  async startFlow(
    chatId: string,
    studentId: string,
    userId: string,
    stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other'
  ): Promise<string> {
    try {
      const flowCostRef = db.collection('llm_flow_costs').doc();
      const flowCostId = flowCostRef.id;

      const flowCost: Omit<LLMFlowCost, 'id'> = {
        chatId,
        studentId,
        userId,
        stage,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalEstimatedCost: 0,
        providerBreakdown: {},
        startedAt: new Date() as any,
        completedAt: null,
        createdAt: new Date() as any
      };

      await flowCostRef.set(flowCost);
      
      // Track this active flow
      this.activeFlows.set(chatId, flowCostId);

      logger.info('Started flow cost tracking', {
        flowCostId,
        chatId,
        studentId,
        userId,
        stage
      });

      return flowCostId;
    } catch (error) {
      logger.error('Error starting flow cost tracking', { error, chatId, studentId, userId, stage });
      throw error;
    }
  }

  /**
   * Add a request to an existing flow
   */
  async addRequestToFlow(
    chatId: string,
    update: FlowCostUpdate
  ): Promise<void> {
    try {
      const flowCostId = this.activeFlows.get(chatId);
      if (!flowCostId) {
        logger.warn('No active flow found for chat', { chatId });
        return;
      }

      // Calculate cost for this request
      const costBreakdown = await costCalculator.calculateCost(
        update.provider,
        update.model,
        update.usage
      );

      // Create request log
      await this.createRequestLog(flowCostId, chatId, update, costBreakdown);

      // Update flow totals
      await this.updateFlowTotals(flowCostId, update, costBreakdown);

      logger.info('Added request to flow', {
        flowCostId,
        chatId,
        provider: update.provider,
        model: update.model,
        cost: costBreakdown.totalCost,
        requestSequence: update.requestSequence
      });
    } catch (error) {
      logger.error('Error adding request to flow', { error, chatId, update });
      throw error;
    }
  }

  /**
   * Complete a flow (when chat is marked as processed)
   */
  async completeFlow(chatId: string): Promise<void> {
    try {
      const flowCostId = this.activeFlows.get(chatId);
      if (!flowCostId) {
        logger.warn('No active flow found for completion', { chatId });
        return;
      }

      const flowCostRef = db.collection('llm_flow_costs').doc(flowCostId);
      await flowCostRef.update({
        completedAt: new Date()
      });

      // Remove from active flows
      this.activeFlows.delete(chatId);

      logger.info('Completed flow cost tracking', { flowCostId, chatId });
    } catch (error) {
      logger.error('Error completing flow', { error, chatId });
      throw error;
    }
  }

  /**
   * Get flow cost by chat ID
   */
  async getFlowCost(chatId: string): Promise<LLMFlowCost | null> {
    try {
      const snapshot = await db.collection('llm_flow_costs')
        .where('chatId', '==', chatId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as LLMFlowCost;
    } catch (error) {
      logger.error('Error getting flow cost', { error, chatId });
      throw error;
    }
  }

  /**
   * Get all flow costs for a user
   */
  async getUserFlowCosts(userId: string): Promise<LLMFlowCost[]> {
    try {
      const snapshot = await db.collection('llm_flow_costs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LLMFlowCost));
    } catch (error) {
      logger.error('Error getting user flow costs', { error, userId });
      throw error;
    }
  }

  /**
   * Get flow costs by stage for a user
   */
  async getUserFlowCostsByStage(userId: string): Promise<{ [stage: string]: LLMFlowCost[] }> {
    try {
      const flowCosts = await this.getUserFlowCosts(userId);
      
      const byStage: { [stage: string]: LLMFlowCost[] } = {};
      for (const flow of flowCosts) {
        if (!byStage[flow.stage]) {
          byStage[flow.stage] = [];
        }
        byStage[flow.stage].push(flow);
      }

      return byStage;
    } catch (error) {
      logger.error('Error getting user flow costs by stage', { error, userId });
      throw error;
    }
  }

  /**
   * Get cost summary for a user
   */
  async getUserCostSummary(userId: string): Promise<{
    totalCost: number;
    totalFlows: number;
    averageCostPerFlow: number;
    stageBreakdown: { [stage: string]: { cost: number; flows: number } };
  }> {
    try {
      const flowCosts = await this.getUserFlowCosts(userId);
      
      let totalCost = 0;
      const stageBreakdown: { [stage: string]: { cost: number; flows: number } } = {};

      for (const flow of flowCosts) {
        totalCost += flow.totalEstimatedCost;
        
        if (!stageBreakdown[flow.stage]) {
          stageBreakdown[flow.stage] = { cost: 0, flows: 0 };
        }
        stageBreakdown[flow.stage].cost += flow.totalEstimatedCost;
        stageBreakdown[flow.stage].flows += 1;
      }

      return {
        totalCost,
        totalFlows: flowCosts.length,
        averageCostPerFlow: flowCosts.length > 0 ? totalCost / flowCosts.length : 0,
        stageBreakdown
      };
    } catch (error) {
      logger.error('Error getting user cost summary', { error, userId });
      throw error;
    }
  }

  /**
   * Create a request log entry
   */
  private async createRequestLog(
    flowCostId: string,
    chatId: string,
    update: FlowCostUpdate,
    costBreakdown: CostBreakdown
  ): Promise<void> {
    const requestLogRef = db.collection('llm_request_logs').doc();
    
    const requestLog: Omit<LLMRequestLog, 'id'> = {
      flowCostId,
      chatId,
      requestSequence: update.requestSequence,
      provider: update.provider,
      model: update.model,
      inputTokens: update.usage.inputTokens,
      outputTokens: update.usage.outputTokens,
      cacheCreationTokens: update.usage.cacheCreationTokens || 0,
      cacheReadTokens: update.usage.cacheReadTokens || 0,
      regularInputTokens: costBreakdown.regularInputTokens,
      estimatedCost: costBreakdown.totalCost,
      timestamp: new Date() as any
    };

    await requestLogRef.set(requestLog);
  }

  /**
   * Update flow totals with new request data using Firestore transactions for safety
   */
  private async updateFlowTotals(
    flowCostId: string,
    update: FlowCostUpdate,
    costBreakdown: CostBreakdown
  ): Promise<void> {
    const flowCostRef = db.collection('llm_flow_costs').doc(flowCostId);
    
    // Use a transaction to prevent race conditions when multiple requests update the same flow
    await db.runTransaction(async (transaction) => {
      const flowDoc = await transaction.get(flowCostRef);
      
      if (!flowDoc.exists) {
        throw new Error(`Flow cost document not found: ${flowCostId}`);
      }

      const currentFlow = flowDoc.data() as LLMFlowCost;
      
      // Validate current data
      if (typeof currentFlow.totalRequests !== 'number') {
        logger.warn('Invalid totalRequests in flow document, resetting to 0', { flowCostId, currentFlow });
        currentFlow.totalRequests = 0;
      }
      
      // Update totals with validation
      const updatedFlow = {
        totalRequests: currentFlow.totalRequests + 1,
        totalInputTokens: (currentFlow.totalInputTokens || 0) + (update.usage.inputTokens || 0),
        totalOutputTokens: (currentFlow.totalOutputTokens || 0) + (update.usage.outputTokens || 0),
        totalCacheCreationTokens: (currentFlow.totalCacheCreationTokens || 0) + (update.usage.cacheCreationTokens || 0),
        totalCacheReadTokens: (currentFlow.totalCacheReadTokens || 0) + (update.usage.cacheReadTokens || 0),
        totalEstimatedCost: (currentFlow.totalEstimatedCost || 0) + (costBreakdown.totalCost || 0)
      };

      // Update provider breakdown with validation
      const providerBreakdown = { ...currentFlow.providerBreakdown };
      if (!providerBreakdown[update.provider]) {
        providerBreakdown[update.provider] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          estimatedCost: 0
        };
      }

      const providerData = providerBreakdown[update.provider];
      providerData.requests = (providerData.requests || 0) + 1;
      providerData.inputTokens = (providerData.inputTokens || 0) + (update.usage.inputTokens || 0);
      providerData.outputTokens = (providerData.outputTokens || 0) + (update.usage.outputTokens || 0);
      providerData.cacheCreationTokens = (providerData.cacheCreationTokens || 0) + (update.usage.cacheCreationTokens || 0);
      providerData.cacheReadTokens = (providerData.cacheReadTokens || 0) + (update.usage.cacheReadTokens || 0);
      providerData.estimatedCost = (providerData.estimatedCost || 0) + (costBreakdown.totalCost || 0);

      // Log the update for debugging
      logger.info('Updating flow totals', {
        flowCostId,
        requestSequence: update.requestSequence,
        provider: update.provider,
        model: update.model,
        tokenUsage: update.usage,
        costBreakdown: costBreakdown.totalCost,
        newTotals: updatedFlow
      });

      // Update the document within the transaction
      transaction.update(flowCostRef, {
        ...updatedFlow,
        providerBreakdown
      });
    });
  }

  /**
   * Get request logs for a flow
   */
  async getFlowRequestLogs(flowCostId: string): Promise<LLMRequestLog[]> {
    try {
      const snapshot = await db.collection('llm_request_logs')
        .where('flowCostId', '==', flowCostId)
        .orderBy('requestSequence', 'asc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LLMRequestLog));
    } catch (error) {
      logger.error('Error getting flow request logs', { error, flowCostId });
      throw error;
    }
  }

  /**
   * Check if a flow is active for a chat
   */
  isFlowActive(chatId: string): boolean {
    return this.activeFlows.has(chatId);
  }

  /**
   * Get active flow ID for a chat
   */
  getActiveFlowId(chatId: string): string | undefined {
    return this.activeFlows.get(chatId);
  }
}

// Export singleton instance
export const flowCostTracker = new FlowCostTracker();
