export interface LLMRequestLog {
  id: string;
  flowId: string;
  userId: string;
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  estimatedCost: number;
  stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other';
  chatId?: string;
}

export interface LLMFlowCost {
  id: string;
  userId: string;
  stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other';
  chatId?: string;
  chatTitle?: string;
  createdAt: Date;
  completedAt?: Date;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationInputTokens: number;
  totalCacheReadInputTokens: number;
  totalEstimatedCost: number;
  requestCount: number;
  isCompleted: boolean;
}

export interface UserCostSummary {
  userId: string;
  userEmail?: string;
  totalCost: number;
  totalFlows: number;
  lastActivity: Date | null;
  averageCostPerFlow: number;
  stageBreakdown: {
    [stage: string]: {
      cost: number;
      flows: number;
    };
  };
}

export interface UserCostBreakdown {
  [stage: string]: {
    totalCost: number;
    flowCount: number;
    averageCostPerFlow: number;
    flows: LLMFlowCost[];
  };
}

export interface LLMPricingConfig {
  id: string;
  provider: 'claude' | 'gemini' | 'openai';
  model: string;
  pricing: {
    inputTokensPerMillion: number;
    outputTokensPerMillion: number;
    cacheCreationInputTokensPerMillion?: number;
    cacheReadInputTokensPerMillion?: number;
  };
  updatedAt: Date;
  updatedBy: string;
  updatedByEmail?: string;
}

export interface FlowCostDetails {
  flow: LLMFlowCost;
  requests: LLMRequestLog[];
}

// API Response types
export interface CostTrackingApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface UserCostSummaryResponse extends CostTrackingApiResponse<UserCostSummary[]> {}
export interface UserFlowsResponse extends CostTrackingApiResponse<LLMFlowCost[]> {}
export interface UserCostBreakdownResponse extends CostTrackingApiResponse<UserCostBreakdown> {}
export interface FlowCostDetailsResponse extends CostTrackingApiResponse<FlowCostDetails> {}
export interface PricingConfigResponse extends CostTrackingApiResponse<LLMPricingConfig[]> {}
