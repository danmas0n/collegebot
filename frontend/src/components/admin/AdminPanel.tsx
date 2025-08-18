import { Box, Typography, Paper, Tabs, Tab, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WhitelistManager } from './WhitelistManager';
import { AISettingsManager } from './AISettingsManager';
import { CostTrackingDashboard } from './CostTrackingDashboard';
import { SubscriptionUserManager } from './SubscriptionUserManager';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(0);


  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          variant="outlined"
        >
          Back to App
        </Button>
        <Typography variant="h4">
          {isAdmin ? "Admin Panel" : "Settings"}
        </Typography>
      </Box>
      
      {isAdmin ? (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="Users & Access" />
              <Tab label="Subscriptions" />
              <Tab label="AI Settings" />
              <Tab label="Cost Tracking" />
            </Tabs>
          </Paper>

          {activeTab === 0 && <WhitelistManager adminView={true} />}
          {activeTab === 1 && <SubscriptionUserManager />}
          {activeTab === 2 && <AISettingsManager />}
          {activeTab === 3 && <CostTrackingDashboard />}
        </>
      ) : (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={0}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="Family Sharing" />
            </Tabs>
          </Paper>

          <WhitelistManager adminView={false} />
        </>
      )}
    </Box>
  );
};
