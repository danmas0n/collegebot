import express, { Request, Response } from 'express';
import { db } from '../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { AISettings } from '../types/firestore.js';

const router = express.Router();

// Get current AI settings
router.get('/ai-settings', async (req: Request, res: Response) => {
  try {
    const settingsRef = db.collection('settings').doc('ai');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      // Return default settings if none exist
      const defaultSettings: AISettings = {
        id: 'current',
        serviceType: (process.env.AI_SERVICE_TYPE || 'claude') as 'claude' | 'gemini',
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        claudeApiKey: process.env.CLAUDE_API_KEY || '',
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        updatedAt: Timestamp.now(),
        updatedBy: ''
      };
      return res.json(defaultSettings);
    }

    res.json({ ...settingsDoc.data(), id: settingsDoc.id });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// Update AI settings
router.post('/ai-settings', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    const settingsRef = db.collection('settings').doc('ai');

    // Update settings with current timestamp
    const updatedSettings: AISettings = {
      ...settings,
      updatedAt: Timestamp.now()
    };

    // Store the current model in the appropriate model field
    if (updatedSettings.serviceType === 'claude') {
      updatedSettings.claudeModel = updatedSettings.model;
    } else {
      updatedSettings.geminiModel = updatedSettings.model;
    }

    await settingsRef.set(updatedSettings);

    // Update environment variables for immediate effect
    process.env.AI_SERVICE_TYPE = updatedSettings.serviceType;
    if (updatedSettings.serviceType === 'claude') {
      process.env.CLAUDE_MODEL = updatedSettings.model;
      if (updatedSettings.claudeApiKey) {
        process.env.CLAUDE_API_KEY = updatedSettings.claudeApiKey;
      }
    } else {
      process.env.GEMINI_MODEL = updatedSettings.model;
      if (updatedSettings.geminiApiKey) {
        process.env.GEMINI_API_KEY = updatedSettings.geminiApiKey;
      }
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

export default router;
