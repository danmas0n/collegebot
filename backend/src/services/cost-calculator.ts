import { db } from '../config/firebase.js';
import { LLMPricingConfig } from '../types/firestore.js';
import { logger } from '../utils/logger.js';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface CostBreakdown {
  regularInputCost: number;
  outputCost: number;
  cacheCreationCost: number;
  cacheReadCost: number;
  totalCost: number;
  regularInputTokens: number;
}

export class CostCalculator {
  private pricingCache: Map<string, LLMPricingConfig> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate cost for Claude with corrected token accounting
   */
  async calculateClaudeCost(
    model: string,
    usage: TokenUsage
  ): Promise<CostBreakdown> {
    const pricing = await this.getPricing('claude', model);
    
    // Calculate regular input tokens (what's left after cache tokens)
    const regularInputTokens = usage.inputTokens - 
      (usage.cacheCreationTokens || 0) - 
      (usage.cacheReadTokens || 0);

    let regularInputCost = 0;
    let outputCost = 0;
    let cacheCreationCost = 0;
    let cacheReadCost = 0;

    // Regular input tokens at standard rate
    if (regularInputTokens > 0) {
      regularInputCost = (regularInputTokens / 1_000_000) * pricing.pricing.input;
    }

    // Output tokens at standard rate  
    outputCost = (usage.outputTokens / 1_000_000) * pricing.pricing.output;

    // Cache creation tokens at cache creation rate
    if (usage.cacheCreationTokens && pricing.pricing.cacheCreation) {
      cacheCreationCost = (usage.cacheCreationTokens / 1_000_000) * pricing.pricing.cacheCreation;
    }

    // Cache read tokens at cache read rate (discounted)
    if (usage.cacheReadTokens && pricing.pricing.cacheRead) {
      cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.pricing.cacheRead;
    }

    const totalCost = regularInputCost + outputCost + cacheCreationCost + cacheReadCost;

    logger.info('Claude cost calculation', {
      model,
      usage,
      regularInputTokens,
      breakdown: {
        regularInputCost,
        outputCost,
        cacheCreationCost,
        cacheReadCost,
        totalCost
      }
    });

    return {
      regularInputCost,
      outputCost,
      cacheCreationCost,
      cacheReadCost,
      totalCost,
      regularInputTokens
    };
  }

  /**
   * Calculate cost for Gemini (simpler - no cache tokens)
   */
  async calculateGeminiCost(
    model: string,
    usage: TokenUsage
  ): Promise<CostBreakdown> {
    const pricing = await this.getPricing('gemini', model);
    
    const regularInputCost = (usage.inputTokens / 1_000_000) * pricing.pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.pricing.output;
    const totalCost = regularInputCost + outputCost;

    logger.info('Gemini cost calculation', {
      model,
      usage,
      breakdown: {
        regularInputCost,
        outputCost,
        totalCost
      }
    });

    return {
      regularInputCost,
      outputCost,
      cacheCreationCost: 0,
      cacheReadCost: 0,
      totalCost,
      regularInputTokens: usage.inputTokens
    };
  }

  /**
   * Calculate cost for OpenAI (simpler - no cache tokens)
   */
  async calculateOpenAICost(
    model: string,
    usage: TokenUsage
  ): Promise<CostBreakdown> {
    const pricing = await this.getPricing('openai', model);
    
    const regularInputCost = (usage.inputTokens / 1_000_000) * pricing.pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.pricing.output;
    const totalCost = regularInputCost + outputCost;

    logger.info('OpenAI cost calculation', {
      model,
      usage,
      breakdown: {
        regularInputCost,
        outputCost,
        totalCost
      }
    });

    return {
      regularInputCost,
      outputCost,
      cacheCreationCost: 0,
      cacheReadCost: 0,
      totalCost,
      regularInputTokens: usage.inputTokens
    };
  }

  /**
   * Generic cost calculation that routes to provider-specific methods
   */
  async calculateCost(
    provider: 'claude' | 'gemini' | 'openai',
    model: string,
    usage: TokenUsage
  ): Promise<CostBreakdown> {
    switch (provider) {
      case 'claude':
        return this.calculateClaudeCost(model, usage);
      case 'gemini':
        return this.calculateGeminiCost(model, usage);
      case 'openai':
        return this.calculateOpenAICost(model, usage);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Get pricing configuration with caching
   */
  private async getPricing(provider: string, model: string): Promise<LLMPricingConfig> {
    const cacheKey = `${provider}-${model}`;
    const now = Date.now();
    
    // Check cache first
    if (this.pricingCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && now < expiry) {
        return this.pricingCache.get(cacheKey)!;
      }
    }

    // Fetch from Firestore
    try {
      const pricingRef = db.collection('llm_pricing_config');
      const snapshot = await pricingRef
        .where('provider', '==', provider)
        .where('model', '==', model)
        .limit(1)
        .get();

      if (snapshot.empty) {
        // Return default pricing if not configured
        const defaultPricing = this.getDefaultPricing(provider, model);
        logger.warn('Using default pricing - no configuration found', {
          provider,
          model,
          defaultPricing
        });
        return defaultPricing;
      }

      const pricingDoc = snapshot.docs[0];
      const pricing = { id: pricingDoc.id, ...pricingDoc.data() } as LLMPricingConfig;
      
      // Cache the result
      this.pricingCache.set(cacheKey, pricing);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
      
      return pricing;
    } catch (error) {
      logger.error('Error fetching pricing configuration', { error, provider, model });
      // Fall back to default pricing
      return this.getDefaultPricing(provider, model);
    }
  }

  /**
   * Get default pricing when no configuration is found
   */
  private getDefaultPricing(provider: string, model: string): LLMPricingConfig {
    const defaultPricing: { [key: string]: { [key: string]: any } } = {
      claude: {
        'claude-3-5-sonnet-20241022': {
          input: 3.00,
          output: 15.00,
          cacheCreation: 3.75,
          cacheRead: 0.30
        },
        'claude-3-5-haiku-20241022': {
          input: 0.25,
          output: 1.25,
          cacheCreation: 0.3125,
          cacheRead: 0.025
        }
      },
      gemini: {
        'gemini-1.5-pro': {
          input: 1.25,
          output: 5.00
        },
        'gemini-1.5-flash': {
          input: 0.075,
          output: 0.30
        }
      },
      openai: {
        'gpt-4': {
          input: 30.00,
          output: 60.00
        },
        'gpt-3.5-turbo': {
          input: 0.50,
          output: 1.50
        }
      }
    };

    const providerDefaults = defaultPricing[provider];
    const modelPricing = providerDefaults?.[model] || providerDefaults?.['default'] || {
      input: 1.00,
      output: 2.00
    };

    return {
      id: 'default',
      provider: provider as 'claude' | 'gemini' | 'openai',
      model,
      pricing: modelPricing,
      updatedAt: new Date() as any,
      updatedBy: 'system'
    };
  }

  /**
   * Clear pricing cache (useful for testing or when pricing is updated)
   */
  clearCache(): void {
    this.pricingCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Initialize default pricing configurations in Firestore
   */
  async initializeDefaultPricing(): Promise<void> {
    const batch = db.batch();
    
    const defaultConfigs = [
      {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        pricing: { input: 3.00, output: 15.00, cacheCreation: 3.75, cacheRead: 0.30 }
      },
      {
        provider: 'claude',
        model: 'claude-3-5-haiku-20241022',
        pricing: { input: 0.25, output: 1.25, cacheCreation: 0.3125, cacheRead: 0.025 }
      },
      {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        pricing: { input: 1.25, output: 5.00 }
      },
      {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        pricing: { input: 0.075, output: 0.30 }
      }
    ];

    for (const config of defaultConfigs) {
      const docRef = db.collection('llm_pricing_config').doc();
      batch.set(docRef, {
        ...config,
        updatedAt: new Date(),
        updatedBy: 'system'
      });
    }

    await batch.commit();
    logger.info('Initialized default pricing configurations');
  }
}

// Export singleton instance
export const costCalculator = new CostCalculator();
