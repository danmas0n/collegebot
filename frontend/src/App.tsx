import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { WizardProvider, useWizard } from './contexts/WizardContext';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ResearchProvider } from './contexts/ResearchContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { Login } from './components/Login';
import { WizardStepper } from './components/WizardStepper';
import { StudentSelectionStage } from './components/stages/StudentSelectionStage';
import { StudentProfileStage } from './components/stages/StudentProfileStage';
import { CollegeInterestsStage } from './components/stages/CollegeInterestsStage';
import { BudgetStage } from './components/stages/BudgetStage';
import { DataCollectionStage } from './components/stages/DataCollectionStage';
import { RecommendationsStage } from './components/stages/RecommendationsStage';
import { MapStage } from './components/stages/MapStage';
import { CalendarStage } from './components/stages/CalendarStage';
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
      case 'calendar':
        return <CalendarStage />;
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
          {!showAdmin && (
            <Button
              color="inherit"
              startIcon={<SettingsIcon />}
              onClick={() => setShowAdmin(true)}
              sx={{ mr: 2 }}
            >
              {isAdmin ? "Admin" : "Settings"}
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
    <NotificationProvider>
      <AuthProvider>
        <WizardProvider>
          <ChatProvider>
            <ResearchProvider>
              <CalendarProvider>
                <AppContent />
              </CalendarProvider>
            </ResearchProvider>
          </ChatProvider>
        </WizardProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;
