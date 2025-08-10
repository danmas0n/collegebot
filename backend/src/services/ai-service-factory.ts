import { ClaudeService } from './claude.js';
import { GeminiService } from './gemini.js';
import { OpenAIService } from './openai.js';
import { settingsService } from './settings.js';

export type AIService = ClaudeService | GeminiService | OpenAIService;

// Helper function to set chat context for cost tracking
export function setChatContextForService(service: AIService, chatId: string, stage: 'recommendations' | 'map' | 'plan' | 'research' | 'other'): void {
  if (service instanceof ClaudeService) {
    service.setChatContext(chatId, stage);
  } else if (service instanceof GeminiService) {
    service.setChatContext(chatId, stage);
  } else if (service instanceof OpenAIService) {
    service.setChatContext(chatId, stage);
  }
}

// Helper function to set student context for cost tracking
export function setStudentContextForService(service: AIService, studentId: string): void {
  if (service instanceof ClaudeService) {
    service.setStudentContext(studentId);
  } else if (service instanceof GeminiService) {
    service.setStudentContext(studentId);
  } else if (service instanceof OpenAIService) {
    service.setStudentContext(studentId);
  }
}

export class AIServiceFactory {
  static async createService(userId?: string): Promise<AIService> {
    const config = await settingsService.getServiceConfig();
    const serviceType = await settingsService.getCurrentServiceType();
    
    switch (serviceType) {
      case 'claude':
        return new ClaudeService(config.apiKey, userId);
      case 'gemini':
        return new GeminiService(config.apiKey, userId);
      case 'openai':
        return new OpenAIService(config.apiKey, userId);
      default:
        throw new Error(`Unsupported AI service type: ${serviceType}`);
    }
  }
}
