import React from 'react';
import { Box, Stepper, Step, StepLabel, Button, styled, Alert, Chip, Typography } from '@mui/material';
import { useWizard } from '../contexts/WizardContext';
import { WizardStage } from '../types/wizard';
import BlockIcon from '@mui/icons-material/Block';
import AutorenewIcon from '@mui/icons-material/Autorenew';

const STAGE_LABELS: Record<WizardStage, string> = {
  'student-selection': 'Select Student',
  'student-profile': 'Student Profile',
  'college-interests': 'Interests',
  'budget': 'Budget',
  'data-collection': 'Data Collection',
  'recommendations': 'Recommendations',
  'map': 'Map',
  'calendar': 'Calendar & Tasks',
};

export const WizardStepper: React.FC = () => {
  const { 
    currentStage, 
    goToStage, 
    canProceed, 
    nextStage, 
    previousStage, 
    currentStudent,
    isNavigationBlocked,
    activeLLMOperations
  } = useWizard();

  const stages = Object.entries(STAGE_LABELS).map(([stage, label]) => ({
    stage: stage as WizardStage,
    label
  }));

  const currentIndex = stages.findIndex(stage => stage.stage === currentStage);

  // Only show stepper if a student is selected
  if (!currentStudent && currentStage === 'student-selection') {
    return null;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Navigation Blocked Alert */}
      {isNavigationBlocked && activeLLMOperations.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          icon={<AutorenewIcon />}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              Navigation is temporarily blocked while AI operations are running:
            </Typography>
            {activeLLMOperations.map((operation) => (
              <Chip
                key={operation.id}
                label={operation.description}
                size="small"
                color="primary"
                variant="outlined"
                icon={<AutorenewIcon />}
              />
            ))}
          </Box>
        </Alert>
      )}

      <Stepper activeStep={currentIndex} sx={{ mb: 4 }}>
        {stages.filter(stage => stage.stage !== 'student-selection').map(({ stage, label }) => (
          <Step key={stage} completed={stages.indexOf({ stage, label }) < currentIndex}>
            <StepLabel
              sx={{
                cursor: isNavigationBlocked ? 'not-allowed' : 'pointer',
                opacity: isNavigationBlocked ? 0.6 : 1,
                '&:hover': !isNavigationBlocked ? {
                  '& .MuiStepLabel-label': {
                    color: 'primary.main',
                    textDecoration: 'underline'
                  }
                } : {}
              }}
              onClick={() => {
                if (!isNavigationBlocked) {
                  goToStage(stage);
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {label}
                {isNavigationBlocked && <BlockIcon fontSize="small" color="disabled" />}
              </Box>
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={previousStage}
            disabled={currentIndex === 0 || isNavigationBlocked}
            startIcon={isNavigationBlocked ? <BlockIcon /> : undefined}
          >
            Back
          </Button>
          {currentStage !== 'student-selection' && (
            <Button
              variant="outlined"
              onClick={() => goToStage('student-selection')}
              disabled={isNavigationBlocked}
              startIcon={isNavigationBlocked ? <BlockIcon /> : undefined}
            >
              Back to Student Selection
            </Button>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={nextStage}
          disabled={!canProceed || currentIndex === stages.length - 1 || isNavigationBlocked}
          startIcon={isNavigationBlocked ? <BlockIcon /> : undefined}
        >
          {currentIndex === stages.length - 2 ? 'Finish' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};
