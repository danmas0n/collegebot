import { db } from '../config/firebase.js';
import { AISettings } from '../types/firestore.js';
import { Timestamp } from 'firebase-admin/firestore';

export class SettingsService {
  private static instance: SettingsService;
  private cachedSettings: AISettings | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getAISettings(): Promise<AISettings> {
    // Return cached settings if they're still fresh
    if (this.cachedSettings && (Date.now() - this.lastFetchTime < this.CACHE_TTL)) {
      return this.cachedSettings;
    }

    const settingsRef = db.collection('settings').doc('ai');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      // Return default settings if none exist
      this.cachedSettings = {
        id: 'current',
        serviceType: (process.env.AI_SERVICE_TYPE || 'claude') as 'claude' | 'gemini' | 'openai',
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        updatedAt: Timestamp.now(),
        updatedBy: 'system'
      };
    } else {
      this.cachedSettings = settingsDoc.data() as AISettings;
    }

    this.lastFetchTime = Date.now();
    return this.cachedSettings!;
  }

  async getCurrentModel(): Promise<string> {
    const settings = await this.getAISettings();
    return settings.model;
  }

  async getCurrentServiceType(): Promise<'claude' | 'gemini' | 'openai'> {
    const settings = await this.getAISettings();
    return settings.serviceType;
  }

  async getCurrentApiKey(): Promise<string> {
    const settings = await this.getAISettings();
    let apiKey: string | undefined;

    if (settings.serviceType === 'claude') {
      apiKey = settings.claudeApiKey || process.env.CLAUDE_API_KEY;
    } else if (settings.serviceType === 'gemini') {
      apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    } else if (settings.serviceType === 'openai') {
      apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    }

    if (!apiKey) {
      throw new Error(`API key not found for service: ${settings.serviceType}`);
    }

    return apiKey;
  }

  async getServiceConfig(): Promise<{ model: string; apiKey: string }> {
    const settings = await this.getAISettings();
    let apiKey: string | undefined;

    if (settings.serviceType === 'claude') {
      apiKey = settings.claudeApiKey || process.env.CLAUDE_API_KEY;
    } else if (settings.serviceType === 'gemini') {
      apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    } else if (settings.serviceType === 'openai') {
      apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    }

    if (!apiKey) {
      throw new Error(`API key not found for service: ${settings.serviceType}`);
    }

    return {
      model: settings.model,
      apiKey
    };
  }

  async getGeminiConfig(): Promise<{ model: string; apiKey: string }> {
    const settings = await this.getAISettings();
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    const model = settings.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    return {
      model,
      apiKey
    };
  }
  async getOpenAIConfig(): Promise<{ model: string; apiKey: string }> {
    const settings = await this.getAISettings();
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    const model = settings.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o';

    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    return {
      model,
      apiKey
    };
  }

  async getWebSearchProvider(): Promise<'mcp' | 'claude-native'> {
    const settings = await this.getAISettings();
    // Default to MCP for backward compatibility
    return settings.webSearchProvider || 'mcp';
  }
}

export const settingsService = SettingsService.getInstance();
