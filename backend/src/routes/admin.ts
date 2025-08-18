import express, { Request, Response } from 'express';
import { db } from '../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { AISettings } from '../types/firestore.js';
import { 
  addWhitelistedUser, 
  removeWhitelistedUser, 
  getWhitelistedUsers,
  getSharedUsers,
  removeSharedAccess,
  addAdmin, 
  isAdmin 
} from '../services/firestore';
import StripeService from '../services/stripe.js';

const router = express.Router();

// User Management Routes

// Get all whitelisted users
router.get('/whitelisted-users', async (req: Request, res: Response) => {
  try {
    const users = await getWhitelistedUsers();
    res.json(users);
  } catch (error) {
    console.error('Error getting whitelisted users:', error);
    res.status(500).json({ error: 'Failed to get whitelisted users' });
  }
});

// Add a user to whitelist
router.post('/whitelist', async (req: Request, res: Response) => {
  try {
    const { email, userId } = req.body;
    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }
    // @ts-ignore - user is added by middleware
    await addWhitelistedUser(email, userId, req.user.email);
    res.json({ message: 'User whitelisted successfully' });
  } catch (error) {
    console.error('Error whitelisting user:', error);
    res.status(500).json({ error: 'Failed to whitelist user' });
  }
});

// Remove a user from whitelist
router.delete('/whitelist/:email', async (req: Request, res: Response) => {
  try {
    await removeWhitelistedUser(req.params.email);
    res.json({ message: 'User removed from whitelist successfully' });
  } catch (error) {
    console.error('Error removing user from whitelist:', error);
    res.status(500).json({ error: 'Failed to remove user from whitelist' });
  }
});

// Get shared users for the current user
router.get('/shared-users', async (req: Request, res: Response) => {
  try {
    // @ts-ignore - user is added by middleware
    const users = await getSharedUsers(req.user.uid);
    res.json(users);
  } catch (error) {
    console.error('Error getting shared users:', error);
    res.status(500).json({ error: 'Failed to get shared users' });
  }
});

// Share access with a user
router.post('/share', async (req: Request, res: Response) => {
  try {
    const { email, userId } = req.body;
    if (!email || !userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }
    // @ts-ignore - user is added by middleware
    await addWhitelistedUser(email, userId, req.user.email, req.user.uid);
    res.json({ message: 'Access shared successfully' });
  } catch (error) {
    console.error('Error sharing access:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to share access'
    });
  }
});

// Remove shared access
router.delete('/share/:email', async (req: Request, res: Response) => {
  try {
    // @ts-ignore - user is added by middleware
    await removeSharedAccess(req.params.email, req.user.uid);
    res.json({ message: 'Shared access removed successfully' });
  } catch (error) {
    console.error('Error removing shared access:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to remove shared access'
    });
  }
});

// AI Settings Routes

// Get current AI settings
router.get('/ai-settings', async (req: Request, res: Response) => {
  try {
    const settingsRef = db.collection('settings').doc('ai');
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      // Return default settings if none exist
      const defaultSettings: AISettings = {
        id: 'current',
        serviceType: (process.env.AI_SERVICE_TYPE || 'claude') as 'claude' | 'gemini' | 'openai',
        model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219',
        claudeModel: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219',
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
        claudeApiKey: process.env.CLAUDE_API_KEY || '',
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        openaiApiKey: process.env.OPENAI_API_KEY || '',
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
    } else if (updatedSettings.serviceType === 'gemini') {
      updatedSettings.geminiModel = updatedSettings.model;
    } else if (updatedSettings.serviceType === 'openai') {
      updatedSettings.openaiModel = updatedSettings.model;
    }

    await settingsRef.set(updatedSettings);

    // Update environment variables for immediate effect
    process.env.AI_SERVICE_TYPE = updatedSettings.serviceType;
    if (updatedSettings.serviceType === 'claude') {
      process.env.CLAUDE_MODEL = updatedSettings.model;
      if (updatedSettings.claudeApiKey) {
        process.env.CLAUDE_API_KEY = updatedSettings.claudeApiKey;
      }
    } else if (updatedSettings.serviceType === 'gemini') {
      process.env.GEMINI_MODEL = updatedSettings.model;
      if (updatedSettings.geminiApiKey) {
        process.env.GEMINI_API_KEY = updatedSettings.geminiApiKey;
      }
    } else if (updatedSettings.serviceType === 'openai') {
      process.env.OPENAI_MODEL = updatedSettings.model;
      if (updatedSettings.openaiApiKey) {
        process.env.OPENAI_API_KEY = updatedSettings.openaiApiKey;
      }
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

// Subscription User Management Routes

// Get all subscription users
router.get('/subscription-users', async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await db.collection('subscription_users').get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (error) {
    console.error('Error getting subscription users:', error);
    res.status(500).json({ error: 'Failed to get subscription users' });
  }
});

// Get detailed subscription info for a user
router.get('/subscription-users/:email/details', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    const status = await StripeService.getSubscriptionStatus(email);
    
    res.json({
      ...status,
      email
    });
  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

// Delete a subscription user (cancel subscription and remove from Firestore)
router.delete('/subscription-users/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    
    // Get user data first
    const userDoc = await db.collection('subscription_users').doc(email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Cancel Stripe subscription if it exists
    if (userData?.stripeCustomerId && userData?.subscriptionId) {
      try {
        const stripe = await import('stripe');
        const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2025-07-30.basil',
        });
        
        await stripeClient.subscriptions.cancel(userData.subscriptionId);
        console.log(`Cancelled Stripe subscription: ${userData.subscriptionId}`);
      } catch (stripeError) {
        console.error('Error cancelling Stripe subscription:', stripeError);
        // Continue with Firestore deletion even if Stripe cancellation fails
      }
    }

    // Handle family members - remove them and reset their trial eligibility
    if (userData?.familyMemberEmails && userData.familyMemberEmails.length > 0) {
      const batch = db.batch();
      
      for (const familyEmail of userData.familyMemberEmails) {
        const familyRef = db.collection('subscription_users').doc(familyEmail);
        // Delete family member records - they can sign up for their own trials
        batch.delete(familyRef);
      }
      
      await batch.commit();
    }

    // Remove main user from subscription_users
    await db.collection('subscription_users').doc(email).delete();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Suspend a subscription user
router.put('/subscription-users/:email/suspend', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    
    await db.collection('subscription_users').doc(email).update({
      accessSuspended: true,
      suspendedAt: Timestamp.now(),
      // @ts-ignore - user is added by middleware
      suspendedBy: req.user.email,
      updatedAt: Timestamp.now()
    });

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Restore a suspended subscription user
router.put('/subscription-users/:email/restore', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    
    await db.collection('subscription_users').doc(email).update({
      accessSuspended: false,
      suspendedAt: null,
      suspendedBy: null,
      restoredAt: Timestamp.now(),
      // @ts-ignore - user is added by middleware
      restoredBy: req.user.email,
      updatedAt: Timestamp.now()
    });

    res.json({ message: 'User restored successfully' });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

// Admin User Management Routes

// Add a new admin user
router.post('/admin-users', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await addAdmin(email);
    res.json({ message: 'Admin user added successfully' });
  } catch (error) {
    console.error('Error adding admin user:', error);
    res.status(500).json({ error: 'Failed to add admin user' });
  }
});

// Get all admin users
router.get('/admin-users', async (req: Request, res: Response) => {
  try {
    const adminsSnapshot = await db.collection('admin_users').get();
    const admins = adminsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(admins);
  } catch (error) {
    console.error('Error getting admin users:', error);
    res.status(500).json({ error: 'Failed to get admin users' });
  }
});

// Remove an admin user
router.delete('/admin-users/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    await db.collection('admin_users').doc(email).delete();
    res.json({ message: 'Admin user removed successfully' });
  } catch (error) {
    console.error('Error removing admin user:', error);
    res.status(500).json({ error: 'Failed to remove admin user' });
  }
});

export default router;
