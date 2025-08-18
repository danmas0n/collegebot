import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import { CreditCard as CreditCardIcon, Security as SecurityIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { currentUser, subscriptionStatus, checkSubscriptionStatus, isWhitelisted, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (currentUser) {
        await checkSubscriptionStatus();
      }
      setLoading(false);
    };

    checkAccess();
  }, [currentUser?.uid]); // Only depend on user ID, not the function

  const handleStartTrial = async () => {
    if (!currentUser?.email) return;

    setCreating(true);
    setError(null);

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Create a setup intent for the trial (requires payment method upfront)
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          returnUrl: window.location.origin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      
      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Error starting trial:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trial');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Debug logging
  console.log('SubscriptionGate: Access check values:', {
    isAdmin,
    isWhitelisted,
    subscriptionStatus,
    hasSubscriptionAccess: subscriptionStatus?.hasAccess,
    userEmail: currentUser?.email
  });

  // If user has access (admin, whitelisted, or subscription), render children
  if (isAdmin || isWhitelisted || subscriptionStatus?.hasAccess) {
    console.log('SubscriptionGate: Access granted, rendering children');
    return <>{children}</>;
  }

  console.log('SubscriptionGate: Access denied, showing subscription screen');

  // Show subscription required screen
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="80vh"
      p={3}
    >
      <Card sx={{ width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CreditCardIcon sx={{ fontSize: 64, color: 'primary.main', mb: 3 }} />
          
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Welcome to Counseled Pro!
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            Start your 7-day free trial to access all features
          </Typography>

          <Stack spacing={2} sx={{ mb: 4 }}>
            <Chip 
              label="7-day free trial" 
              color="success" 
              sx={{ fontSize: '1rem', py: 1, height: 'auto' }}
            />
            <Chip 
              label="Then $39/month" 
              color="primary" 
              sx={{ fontSize: '1rem', py: 1, height: 'auto' }}
            />
            <Chip 
              label="Cancel anytime" 
              color="default" 
              sx={{ fontSize: '1rem', py: 1, height: 'auto' }}
            />
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={creating ? <CircularProgress size={20} /> : <CreditCardIcon />}
            onClick={handleStartTrial}
            disabled={creating}
            sx={{ 
              py: 2, 
              px: 4, 
              fontSize: '1.1rem',
              mb: 3
            }}
          >
            {creating ? 'Setting up your trial...' : 'Start Free Trial'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <SecurityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Secure payment processing by Stripe
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary">
            Your trial includes access to all Counseled Pro features:
            AI-powered recommendations, family collaboration, and comprehensive college planning tools.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubscriptionGate;
