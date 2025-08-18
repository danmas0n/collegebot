import { Request, Response, NextFunction } from 'express';
import StripeService from '../services/stripe';
import { logger } from '../utils/logger.js';

/**
 * Middleware to check if user has valid subscription access
 */
export const subscriptionMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      logger.warn('Subscription middleware: User not authenticated', { url: req.originalUrl });
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const email = req.user.email;
    const subscriptionStatus = await StripeService.getSubscriptionStatus(email);

    if (!subscriptionStatus.hasAccess) {
      logger.warn('Subscription middleware: User does not have access', { 
        email,
        accessType: subscriptionStatus.accessType,
        url: req.originalUrl
      });
      
      res.status(403).json({ 
        error: 'Subscription required',
        accessType: subscriptionStatus.accessType,
        message: 'Please subscribe to Counseled Pro to access this feature'
      });
      return;
    }

    // Add subscription info to request for use in routes
    req.subscriptionStatus = subscriptionStatus;
    
    logger.debug('Subscription middleware: Access granted', { 
      email,
      accessType: subscriptionStatus.accessType,
      url: req.originalUrl
    });
    
    next();
  } catch (error) {
    logger.error('Subscription middleware error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: req.originalUrl
    });
    res.status(500).json({ error: 'Server error checking subscription' });
    return;
  }
};

/**
 * Middleware specifically for main account features (family management, billing)
 */
export const mainAccountMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const email = req.user.email;
    const subscriptionStatus = await StripeService.getSubscriptionStatus(email);

    if (!subscriptionStatus.hasAccess) {
      res.status(403).json({ 
        error: 'Subscription required',
        message: 'Please subscribe to Counseled Pro to access this feature'
      });
      return;
    }

    if (subscriptionStatus.accessType !== 'subscription' || !subscriptionStatus.isMainAccount) {
      res.status(403).json({ 
        error: 'Main account required',
        message: 'This feature is only available to main account holders'
      });
      return;
    }

    req.subscriptionStatus = subscriptionStatus;
    next();
  } catch (error) {
    logger.error('Main account middleware error', { 
      error: error instanceof Error ? error.message : String(error),
      url: req.originalUrl
    });
    res.status(500).json({ error: 'Server error' });
    return;
  }
};

// Extend Express Request type to include subscription status
declare global {
  namespace Express {
    interface Request {
      subscriptionStatus?: {
        hasAccess: boolean;
        accessType: 'admin' | 'manual' | 'subscription' | 'family' | 'none';
        subscriptionStatus?: string;
        trialDaysRemaining?: number;
        isMainAccount?: boolean;
        familyMemberCount?: number;
      };
    }
  }
}
