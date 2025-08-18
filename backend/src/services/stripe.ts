import Stripe from 'stripe';
import { db } from '../config/firebase';
import { SubscriptionUser, WhitelistedUser } from '../types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil',
  });
} else {
  console.warn('STRIPE_SECRET_KEY not found. Stripe functionality will be disabled.');
}

// Helper function to ensure Stripe is initialized
function ensureStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

export class StripeService {
  /**
   * Create a Stripe customer and subscription for a main account
   */
  static async createSubscription(email: string, paymentMethodId: string): Promise<{
    subscriptionId: string;
    clientSecret: string;
    customerId: string;
  }> {
    try {
      const stripeClient = ensureStripe();
      
      // Create or retrieve customer
      let customer = await this.findCustomerByEmail(email);
      
      if (!customer) {
        customer = await stripeClient.customers.create({
          email,
          metadata: {
            product: 'counseled',
            source: 'collegebot'
          }
        });
      }

      // Attach payment method to customer
      await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripeClient.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription with trial
      const subscription = await stripeClient.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: process.env.STRIPE_PRICE_ID!, // Counseled Pro price ID
          },
        ],
        trial_period_days: 7,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          product: 'counseled',
          source: 'collegebot',
          mainAccountEmail: email
        }
      });

      // Create user in subscription_users collection
      await this.createSubscriptionUser(email, {
        stripeCustomerId: customer.id,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status as any,
        isMainAccount: true,
        trialUsed: true,
        familyMemberEmails: []
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      let clientSecret = '';
      
      // For trials, there might not be a payment intent initially
      if (invoice && (invoice as any).payment_intent) {
        const paymentIntentData = (invoice as any).payment_intent;
        // payment_intent can be a string ID or expanded PaymentIntent object
        if (typeof paymentIntentData === 'string') {
          // If it's just an ID, we'd need to fetch it, but for trials it might not be needed
          clientSecret = '';
        } else {
          // It's an expanded PaymentIntent object
          const paymentIntent = paymentIntentData as Stripe.PaymentIntent;
          clientSecret = paymentIntent.client_secret || '';
        }
      }

      return {
        subscriptionId: subscription.id,
        clientSecret,
        customerId: customer.id
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Add a family member to a main account
   */
  static async addFamilyMember(mainAccountEmail: string, familyMemberEmail: string): Promise<void> {
    try {
      const mainAccountRef = db.collection('subscription_users').doc(mainAccountEmail);
      const mainAccountDoc = await mainAccountRef.get();
      
      if (!mainAccountDoc.exists) {
        throw new Error('Main account not found');
      }

      const mainAccount = mainAccountDoc.data() as SubscriptionUser;
      
      // Check if main account has active subscription
      if (!this.hasActiveSubscription(mainAccount)) {
        throw new Error('Main account does not have active subscription');
      }

      // Check family member limit (5 additional members)
      const currentFamilyMembers = mainAccount.familyMemberEmails || [];
      if (currentFamilyMembers.length >= 5) {
        throw new Error('Family member limit reached (5 additional members)');
      }

      // Check if family member already exists
      if (currentFamilyMembers.includes(familyMemberEmail)) {
        throw new Error('Family member already added');
      }

      // Add family member to main account
      await mainAccountRef.update({
        familyMemberEmails: [...currentFamilyMembers, familyMemberEmail],
        updatedAt: Timestamp.now()
      });

      // Create family member record in subscription_users collection
      const familyMemberRef = db.collection('subscription_users').doc(familyMemberEmail);
      await familyMemberRef.set({
        email: familyMemberEmail,
        userId: '', // Will be set when they first sign in
        stripeCustomerId: mainAccount.stripeCustomerId, // Share the same customer
        subscriptionId: mainAccount.subscriptionId, // Share the same subscription
        subscriptionStatus: mainAccount.subscriptionStatus,
        isMainAccount: false,
        trialUsed: true, // Family members can't use trial
        parentAccountEmail: mainAccountEmail,
        createdAt: Timestamp.now()
      });

    } catch (error) {
      console.error('Error adding family member:', error);
      throw error;
    }
  }

  /**
   * Remove a family member and transfer their students
   */
  static async removeFamilyMember(mainAccountEmail: string, familyMemberEmail: string): Promise<void> {
    try {
      // Remove from main account's family list
      const mainAccountRef = db.collection('subscription_users').doc(mainAccountEmail);
      const mainAccountDoc = await mainAccountRef.get();
      
      if (mainAccountDoc.exists) {
        const mainAccount = mainAccountDoc.data() as SubscriptionUser;
        const updatedFamilyMembers = (mainAccount.familyMemberEmails || [])
          .filter(email => email !== familyMemberEmail);
        
        await mainAccountRef.update({
          familyMemberEmails: updatedFamilyMembers,
          updatedAt: Timestamp.now()
        });
      }

      // Remove family member from subscription_users
      await db.collection('subscription_users').doc(familyMemberEmail).delete();

      // Create them as a new potential subscriber (reset trial eligibility)
      // They'll need to sign up for their own subscription

      // Transfer student ownership
      const studentsQuery = await db.collection('students')
        .where('createdBy', '==', familyMemberEmail)
        .get();

      const batch = db.batch();
      studentsQuery.docs.forEach(doc => {
        batch.update(doc.ref, {
          subscriptionOwner: familyMemberEmail // Transfer ownership
        });
      });

      await batch.commit();

    } catch (error) {
      console.error('Error removing family member:', error);
      throw error;
    }
  }

  /**
   * Get subscription status for a user
   */
  static async getSubscriptionStatus(email: string): Promise<{
    hasAccess: boolean;
    accessType: 'admin' | 'manual' | 'subscription' | 'family' | 'none';
    subscriptionStatus?: string;
    trialDaysRemaining?: number;
    isMainAccount?: boolean;
    familyMemberCount?: number;
    userData?: any;
  }> {
    try {
      // Check if admin
      const adminDoc = await db.collection('admin_users').doc(email).get();
      if (adminDoc.exists) {
        return { hasAccess: true, accessType: 'admin' };
      }

      // Check subscription status
      const subscriptionDoc = await db.collection('subscription_users').doc(email).get();
      if (subscriptionDoc.exists) {
        const user = subscriptionDoc.data() as SubscriptionUser;
        
        // If Stripe is not configured, fall back to local subscription status
        if (!stripe) {
          const hasAccess = this.hasActiveSubscription(user) || this.isInGracePeriod(user);
          return {
            hasAccess,
            accessType: user.isMainAccount ? 'subscription' : 'family',
            subscriptionStatus: user.subscriptionStatus,
            isMainAccount: user.isMainAccount,
            familyMemberCount: user.familyMemberEmails?.length || 0,
            userData: user
          };
        }

        const stripeClient = ensureStripe();
        const subscription = await stripeClient.subscriptions.retrieve(user.subscriptionId);
        const hasAccess = (this.hasActiveSubscription(user) || this.isInGracePeriod(user)) && !user.accessSuspended;
        
        let trialDaysRemaining: number | undefined;
        if (subscription.status === 'trialing' && subscription.trial_end) {
          const trialEndDate = new Date(subscription.trial_end * 1000);
          const now = new Date();
          trialDaysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }

        return {
          hasAccess,
          accessType: user.isMainAccount ? 'subscription' : 'family',
          subscriptionStatus: subscription.status,
          trialDaysRemaining,
          isMainAccount: user.isMainAccount,
          familyMemberCount: user.familyMemberEmails?.length || 0,
          userData: user
        };
      }

      // Check manual whitelist status
      const whitelistDoc = await db.collection('whitelisted_users').doc(email).get();
      if (whitelistDoc.exists) {
        return { 
          hasAccess: true, 
          accessType: 'manual',
          userData: whitelistDoc.data()
        };
      }

      return { hasAccess: false, accessType: 'none' };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return { hasAccess: false, accessType: 'none' };
    }
  }

  /**
   * Create Stripe Customer Portal session
   */
  static async createPortalSession(email: string, returnUrl: string): Promise<string> {
    try {
      const userDoc = await db.collection('subscription_users').doc(email).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const user = userDoc.data() as SubscriptionUser;
      if (!user.stripeCustomerId) {
        throw new Error('No Stripe customer found');
      }

      const stripeClient = ensureStripe();
      const session = await stripeClient.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Private helper methods
  private static async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const stripeClient = ensureStripe();
    const customers = await stripeClient.customers.list({
      email,
      limit: 1
    });
    return customers.data.length > 0 ? customers.data[0] : null;
  }

  private static async createSubscriptionUser(email: string, data: Partial<SubscriptionUser>): Promise<void> {
    const userRef = db.collection('subscription_users').doc(email);
    const userData: SubscriptionUser = {
      email,
      userId: '', // Will be set when they first sign in
      stripeCustomerId: data.stripeCustomerId!,
      subscriptionId: data.subscriptionId!,
      subscriptionStatus: data.subscriptionStatus!,
      isMainAccount: data.isMainAccount!,
      trialUsed: data.trialUsed!,
      familyMemberEmails: data.familyMemberEmails || [],
      createdAt: Timestamp.now(),
      ...data
    };
    await userRef.set(userData);
  }

  private static async updateSubscriptionUser(email: string, data: Partial<SubscriptionUser>): Promise<void> {
    const userRef = db.collection('subscription_users').doc(email);
    await userRef.update({
      ...data,
      updatedAt: Timestamp.now()
    });
  }

  private static hasActiveSubscription(user: SubscriptionUser): boolean {
    return user.subscriptionStatus === 'trialing' || user.subscriptionStatus === 'active';
  }

  private static isInGracePeriod(user: SubscriptionUser): boolean {
    if (user.subscriptionStatus !== 'past_due' || !user.gracePeriodStarted) {
      return false;
    }
    
    const gracePeriodEnd = new Date(user.gracePeriodStarted.toDate());
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);
    return new Date() < gracePeriodEnd;
  }

  private static async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const stripeClient = ensureStripe();
    const customer = await stripeClient.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (!customer.email) return;

    console.log(`Creating subscription user: ${customer.email}`);

    // Create user record with subscription data
    await this.createSubscriptionUser(customer.email, {
      stripeCustomerId: customer.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      isMainAccount: true,
      trialUsed: true,
      familyMemberEmails: [],
      accessSuspended: false
    });

    console.log(`Subscription user created successfully: ${customer.email}`);
  }

  private static async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const stripeClient = ensureStripe();
    const customer = await stripeClient.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    if (!customer.email) return;

    const userRef = db.collection('subscription_users').doc(customer.email);
    const userDoc = await userRef.get();

    const updates: Partial<SubscriptionUser> = {
      subscriptionStatus: subscription.status as any
    };

    // Handle grace period for past_due
    if (subscription.status === 'past_due') {
      updates.gracePeriodStarted = Timestamp.now();
      updates.accessSuspended = false;
    } else if (subscription.status === 'active') {
      // Clear grace period if it exists
      if (userDoc.exists && userDoc.data()?.gracePeriodStarted) {
        updates.gracePeriodStarted = undefined;
      }
      updates.accessSuspended = false;
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      updates.accessSuspended = true;
    }

    await this.updateSubscriptionUser(customer.email, updates);

    // Update family members too
    if (userDoc.exists) {
      const user = userDoc.data() as SubscriptionUser;
      if (user.isMainAccount && user.familyMemberEmails) {
        const batch = db.batch();
        user.familyMemberEmails.forEach(familyEmail => {
          const familyRef = db.collection('subscription_users').doc(familyEmail);
          batch.update(familyRef, {
            subscriptionStatus: subscription.status as any,
            accessSuspended: updates.accessSuspended,
            updatedAt: Timestamp.now()
          });
        });
        await batch.commit();
      }
    }
  }

  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeClient = ensureStripe();
    const customer = await stripeClient.customers.retrieve(invoice.customer as string) as Stripe.Customer;
    if (!customer.email) return;

    await this.updateSubscriptionUser(customer.email, {
      gracePeriodStarted: Timestamp.now(),
      accessSuspended: false // Give 3-day grace period
    });
  }

  private static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const stripeClient = ensureStripe();
    const customer = await stripeClient.customers.retrieve(invoice.customer as string) as Stripe.Customer;
    if (!customer.email) return;

    // Get current user data
    const userRef = db.collection('subscription_users').doc(customer.email);
    const userDoc = await userRef.get();
    
    // If user doesn't exist, create them (this can happen if subscription.created webhook failed)
    if (!userDoc.exists) {
      console.log(`Creating subscription user from payment success: ${customer.email}`);
      
      // Get subscription info to create user properly
      const subscriptions = await stripeClient.subscriptions.list({
        customer: customer.id,
        limit: 1
      });
      
      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        await this.createSubscriptionUser(customer.email, {
          stripeCustomerId: customer.id,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status as any,
          isMainAccount: true,
          trialUsed: true,
          familyMemberEmails: [],
          accessSuspended: false
        });
        
        console.log(`Subscription user created from payment success: ${customer.email}`);
        return;
      }
    }

    const updates: Partial<SubscriptionUser> = {
      accessSuspended: false
    };

    // Clear grace period if it exists
    if (userDoc.exists && userDoc.data()?.gracePeriodStarted) {
      updates.gracePeriodStarted = undefined;
    }

    await this.updateSubscriptionUser(customer.email, updates);
  }
}

export default StripeService;
