import React from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Map as MapIcon,
  Group as FamilyIcon,
  School as CounselorIcon,
  Schedule as TimelineIcon,
  AttachMoney as MoneyIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  TrendingUp as GrowthIcon,
} from '@mui/icons-material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../contexts/AuthContext';
import { trackUserLogin } from '../utils/analytics';

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
    <CardContent sx={{ textAlign: 'center', p: 3 }}>
      <Box sx={{ color: 'primary.main', mb: 2 }}>
        {icon}
      </Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </CardContent>
  </Card>
);

const StatCard: React.FC<{
  value: string;
  label: string;
  highlight?: boolean;
}> = ({ value, label, highlight = false }) => (
  <Paper 
    sx={{ 
      p: 3, 
      textAlign: 'center',
      bgcolor: highlight ? 'primary.main' : 'background.paper',
      color: highlight ? 'primary.contrastText' : 'text.primary',
      border: highlight ? 'none' : 1,
      borderColor: 'divider'
    }}
  >
    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
      {value}
    </Typography>
    <Typography variant="body2" sx={{ opacity: highlight ? 0.9 : 0.7 }}>
      {label}
    </Typography>
  </Paper>
);

export const LandingPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      trackUserLogin();
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: 8, pb: 6 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography 
            variant={isMobile ? "h3" : "h2"} 
            component="h1" 
            gutterBottom 
            sx={{ fontWeight: 700, mb: 3 }}
          >
            Your AI-Powered College Planning Companion
          </Typography>
          <Typography 
            variant="h5" 
            color="text.secondary" 
            sx={{ mb: 4, maxWidth: '800px', mx: 'auto' }}
          >
            Save thousands while getting personalized guidance through every step 
            of the college admissions journey
          </Typography>
          
          {/* Cost Comparison */}
          <Stack 
            direction={isMobile ? "column" : "row"} 
            spacing={2} 
            justifyContent="center" 
            alignItems="center"
            sx={{ mb: 4 }}
          >
            <StatCard value="$10,000+" label="Traditional Counselor (per year)" />
            <Typography variant="h4" sx={{ color: 'text.secondary', px: 2 }}>
              vs
            </Typography>
            <StatCard value="$39" label="Counseled Pro (per month)" highlight />
          </Stack>

          {/* Primary CTA */}
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleLogin}
            sx={{ 
              py: 2, 
              px: 4, 
              fontSize: '1.1rem',
              borderRadius: 2,
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            Sign in with Google to Get Started
          </Button>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            7-day free trial • Then $39/month • Secure Google authentication
          </Typography>
        </Box>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, fontWeight: 600 }}>
          Everything You Need for College Success
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<AIIcon sx={{ fontSize: 48 }} />}
              title="AI-Powered Recommendations"
              description="Get personalized college suggestions based on your unique academic profile, interests, and budget using advanced AI analysis."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<MapIcon sx={{ fontSize: 48 }} />}
              title="Interactive Maps & Planning"
              description="Visualize college locations, plan campus visits, and organize your college tour with integrated Google Maps."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<FamilyIcon sx={{ fontSize: 48 }} />}
              title="Family Collaboration"
              description="Share your college planning journey with up to 5 additional family members. Everyone stays informed as plans evolve."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<CounselorIcon sx={{ fontSize: 48 }} />}
              title="Professional Support"
              description="Connect with verified college counselors when you need expert guidance. Get professional help without the premium price."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<TimelineIcon sx={{ fontSize: 48 }} />}
              title="Timeline Management"
              description="Never miss a deadline with personalized application timelines, automatic task generation, and deadline tracking."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FeatureCard
              icon={<MoneyIcon sx={{ fontSize: 48 }} />}
              title="Financial Planning"
              description="Understand true costs, explore financial aid options, and make informed decisions about college affordability."
            />
          </Grid>
        </Grid>
      </Container>

      {/* Collaboration Highlights */}
      <Box sx={{ bgcolor: 'grey.50', py: 6 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, fontWeight: 600 }}>
            Built for Collaboration
          </Typography>
          
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Involve Your Whole Family
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip icon={<FamilyIcon />} label="Up to 5 Additional Family Members" color="primary" />
                </Box>
                <Typography variant="body1">
                  Share progress and collaborate with parents, siblings, and extended family. 
                  Everyone can contribute to the decision-making process.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip icon={<CounselorIcon />} label="Professional Counselors" color="secondary" />
                </Box>
                <Typography variant="body1">
                  Connect with verified college counselors who can provide expert guidance 
                  and work directly within your family's planning process.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip icon={<GrowthIcon />} label="Real-time Updates" color="success" />
                </Box>
                <Typography variant="body1">
                  All family members see updates instantly as college lists evolve, 
                  applications progress, and decisions are made.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                  Why Families Choose Counseled
                </Typography>
                <Stack spacing={3} sx={{ mt: 3 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>Comprehensive Platform</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Everything you need in one place - no juggling multiple tools or spreadsheets
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" gutterBottom>Data-Driven Insights</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      AI-powered recommendations based on real data, not just opinions
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" gutterBottom>Massive Savings</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Get professional-level guidance at a fraction of traditional counselor costs
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Trust & Security */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, fontWeight: 600 }}>
          Trusted & Secure
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <SecurityIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Secure Authentication
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your data is protected with Google's industry-leading security. 
                We never store your passwords or personal credentials.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <VerifiedIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Privacy First
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your family's college planning data stays private and secure. 
                We never share your information with third parties.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <GrowthIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Built by Experts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created by professionals who understand the college planning process 
                and the challenges families face.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Final CTA */}
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 6 }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
              Ready to Transform Your College Planning?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Join thousands of families who are making smarter college decisions with Counseled Pro
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<GoogleIcon />}
              onClick={handleLogin}
              sx={{ 
                py: 2, 
                px: 4, 
                fontSize: '1.1rem',
                bgcolor: 'background.paper',
                color: 'primary.main',
                borderRadius: 2,
                boxShadow: 3,
                '&:hover': { 
                  bgcolor: 'grey.100',
                  boxShadow: 6 
                }
              }}
            >
              Get Started Free with Google
            </Button>
            <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
              Start your 7-day free trial today
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};
