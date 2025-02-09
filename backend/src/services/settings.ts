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
        serviceType: (process.env.AI_SERVICE_TYPE || 'claude') as 'claude' | 'gemini',
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

  async getCurrentServiceType(): Promise<'claude' | 'gemini'> {
    const settings = await this.getAISettings();
    return settings.serviceType;
  }

  async getCurrentApiKey(): Promise<string> {
    const settings = await this.getAISettings();
    let apiKey: string | undefined;

    if (settings.serviceType === 'claude') {
      apiKey = settings.claudeApiKey || process.env.CLAUDE_API_KEY;
    } else {
      apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
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
    } else {
      apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    }

    if (!apiKey) {
      throw new Error(`API key not found for service: ${settings.serviceType}`);
    }

    return {
      model: settings.model,
      apiKey
    };
  }
}

export const settingsService = SettingsService.getInstance();
