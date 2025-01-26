import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
} from '@mui/material';
import { WizardProvider, useWizard } from './contexts/WizardContext';
import { ClaudeProvider } from './contexts/ClaudeContext';
import { ChatProvider } from './contexts/ChatContext';
import { WizardStepper } from './components/WizardStepper';
import { StudentSelectionStage } from './components/stages/StudentSelectionStage';
import { StudentProfileStage } from './components/stages/StudentProfileStage';
import { CollegeInterestsStage } from './components/stages/CollegeInterestsStage';
import { BudgetStage } from './components/stages/BudgetStage';
import { DataCollectionStage } from './components/stages/DataCollectionStage';
import { RecommendationsStage } from './components/stages/RecommendationsStage';
import { MapStage } from './components/stages/MapStage';

const WizardContent: React.FC = () => {
  const { currentStage } = useWizard();

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

const App: React.FC = () => {
  return (
    <ClaudeProvider>
      <WizardProvider>
        <ChatProvider>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static">
              <Toolbar>
                <Typography variant="h6" component="div">
                  CollegeBot
                </Typography>
              </Toolbar>
            </AppBar>

            <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
              <WizardContent />
            </Container>
          </Box>
        </ChatProvider>
      </WizardProvider>
    </ClaudeProvider>
  );
};

export default App;
