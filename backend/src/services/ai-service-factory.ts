import { ClaudeService } from './claude.js';
import { GeminiService } from './gemini.js';

export type AIService = ClaudeService | GeminiService;

export class AIServiceFactory {
  static createService(serviceType: string, apiKey: string, userId?: string): AIService {
    switch (serviceType.toLowerCase()) {
      case 'claude':
        return new ClaudeService(apiKey, userId);
      case 'gemini':
        return new GeminiService(apiKey);
      default:
        throw new Error(`Unsupported AI service type: ${serviceType}`);
    }
  }
}
