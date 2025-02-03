import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { WizardProvider, useWizard } from './contexts/WizardContext';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { WizardStepper } from './components/WizardStepper';
import { StudentSelectionStage } from './components/stages/StudentSelectionStage';
import { StudentProfileStage } from './components/stages/StudentProfileStage';
import { CollegeInterestsStage } from './components/stages/CollegeInterestsStage';
import { BudgetStage } from './components/stages/BudgetStage';
import { DataCollectionStage } from './components/stages/DataCollectionStage';
import { RecommendationsStage } from './components/stages/RecommendationsStage';
import { MapStage } from './components/stages/MapStage';
import { AdminPanel } from './components/admin/AdminPanel';

const WizardContent: React.FC = () => {
  const { currentStage } = useWizard();
  const { currentUser, isWhitelisted } = useAuth();

  if (!currentUser || !isWhitelisted) {
    return <Login />;
  }

  const renderStage = () => {
    switch (currentStage) {
      case 'student-selection':
        return <StudentSelectionStage />;
      case 'student-profile':
        return <StudentProfileStage />;
      case 'college-interests':
        return <CollegeInterestsStage />;
      case 'budget':
        return <BudgetStage />;
      case 'data-collection':
        return <DataCollectionStage />;
      case 'recommendations':
        return <RecommendationsStage />;
      case 'map':
        return <MapStage />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <WizardStepper />
      {renderStage()}
    </Box>
  );
};

const AppContent: React.FC = () => {
  const { isAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  const handleExitAdmin = () => {
    setShowAdmin(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CollegeBot
          </Typography>
          {isAdmin && !showAdmin && (
            <Button
              color="inherit"
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => setShowAdmin(true)}
              sx={{ mr: 2 }}
            >
              Admin
            </Button>
          )}
          <Login />
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        {showAdmin ? <AdminPanel onBack={handleExitAdmin} /> : <WizardContent />}
      </Container>
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WizardProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </WizardProvider>
    </AuthProvider>
  );
};

export default App;
