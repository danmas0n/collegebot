import { Box, Typography, Paper, Tabs, Tab, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WhitelistManager } from './WhitelistManager';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel = ({ onBack }: AdminPanelProps) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3 }}>
          <Typography color="error">
            You do not have permission to access the admin panel.
          </Typography>
        </Paper>
      </Box>
    );
  }

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
          Admin Panel
        </Typography>
      </Box>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Whitelist Management" />
          {/* Add more tabs here as needed */}
        </Tabs>
      </Paper>

      {activeTab === 0 && <WhitelistManager />}
    </Box>
  );
}; 