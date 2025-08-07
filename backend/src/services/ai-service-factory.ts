import { ClaudeService } from './claude.js';
import { GeminiService } from './gemini.js';
import { OpenAIService } from './openai.js';
import { settingsService } from './settings.js';

export type AIService = ClaudeService | GeminiService | OpenAIService;

// Helper function to set chat context for cost tracking
export function setChatContextForService(service: AIService, chatId: string, stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other'): void {
  if (service instanceof ClaudeService) {
    service.setChatContext(chatId, stage);
  }
  // Add similar methods for other services when they support cost tracking
}

export class AIServiceFactory {
  static async createService(userId?: string): Promise<AIService> {
    const config = await settingsService.getServiceConfig();
    const serviceType = await settingsService.getCurrentServiceType();
    
    switch (serviceType) {
      case 'claude':
        return new ClaudeService(config.apiKey, userId);
      case 'gemini':
        return new GeminiService(config.apiKey);
      case 'openai':
        return new OpenAIService(config.apiKey, userId);
      default:
        throw new Error(`Unsupported AI service type: ${serviceType}`);
    }
  }
}
