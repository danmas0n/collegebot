import express from 'express';
import Stripe from 'stripe';
import StripeService from '../services/stripe';

const router = express.Router();

/**
 * Create a subscription for a main account
 */
router.post('/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;

    if (!email || !paymentMethodId) {
      return res.status(400).json({ error: 'Email and payment method ID are required' });
    }

    const result = await StripeService.createSubscription(email, paymentMethodId);
    
    res.json({
      success: true,
      subscriptionId: result.subscriptionId,
      clientSecret: result.clientSecret,
      customerId: result.customerId
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a Stripe Checkout session for trial signup
 */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, returnUrl } = req.body;

    if (!email || !returnUrl) {
      return res.status(400).json({ error: 'Email and return URL are required' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil',
    });

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          product: 'counseled',
          source: 'collegebot',
          mainAccountEmail: email
        }
      },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      metadata: {
        product: 'counseled',
        source: 'collegebot',
        mainAccountEmail: email
      }
    });

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get subscription status for a user
 */
router.get('/status', async (req, res) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const status = await StripeService.getSubscriptionStatus(email);
    res.json(status);
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Add a family member to a main account
 */
router.post('/add-family-member', async (req, res) => {
  try {
    const { mainAccountEmail, familyMemberEmail } = req.body;

    if (!mainAccountEmail || !familyMemberEmail) {
      return res.status(400).json({ error: 'Main account email and family member email are required' });
    }

    await StripeService.addFamilyMember(mainAccountEmail, familyMemberEmail);
    
    res.json({ success: true, message: 'Family member added successfully' });
  } catch (error) {
    console.error('Error adding family member:', error);
    res.status(500).json({ 
      error: 'Failed to add family member',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Remove a family member from a main account
 */
router.delete('/remove-family-member/:email', async (req, res) => {
  try {
    const { mainAccountEmail } = req.body;
    const familyMemberEmail = req.params.email;

    if (!mainAccountEmail || !familyMemberEmail) {
      return res.status(400).json({ error: 'Main account email and family member email are required' });
    }

    await StripeService.removeFamilyMember(mainAccountEmail, familyMemberEmail);
    
    res.json({ success: true, message: 'Family member removed successfully' });
  } catch (error) {
    console.error('Error removing family member:', error);
    res.status(500).json({ 
      error: 'Failed to remove family member',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a Stripe Customer Portal session
 */
router.post('/create-portal-session', async (req, res) => {
  try {
    const { email, returnUrl } = req.body;

    if (!email || !returnUrl) {
      return res.status(400).json({ error: 'Email and return URL are required' });
    }

    const portalUrl = await StripeService.createPortalSession(email, returnUrl);
    
    res.json({ success: true, url: portalUrl });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ 
      error: 'Failed to create portal session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  try {
    await StripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ 
      error: 'Failed to handle webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
