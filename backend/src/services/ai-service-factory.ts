import { ClaudeService } from './claude.js';
import { GeminiService } from './gemini.js';
import { OpenAIService } from './openai.js';
import { settingsService } from './settings.js';

export type AIService = ClaudeService | GeminiService | OpenAIService;

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
