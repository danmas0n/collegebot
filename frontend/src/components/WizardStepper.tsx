import React from 'react';
import { Box, Stepper, Step, StepLabel, Button, styled } from '@mui/material';
import { useWizard } from '../contexts/WizardContext';
import { WizardStage } from '../types/wizard';

const STAGE_LABELS: Record<WizardStage, string> = {
  'student-selection': 'Select Student',
  'student-profile': 'Student Profile',
  'college-interests': 'Interests',
  'budget': 'Budget',
  'data-collection': 'Data Collection',
  'recommendations': 'Recommendations',
  'map': 'Map',
};

export const WizardStepper: React.FC = () => {
  const { currentStage, goToStage, canProceed, nextStage, previousStage, currentStudent } = useWizard();

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
      <Stepper activeStep={currentIndex} sx={{ mb: 4 }}>
        {stages.filter(stage => stage.stage !== 'student-selection').map(({ stage, label }) => (
          <Step key={stage} completed={stages.indexOf({ stage, label }) < currentIndex}>
            <StepLabel
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  '& .MuiStepLabel-label': {
                    color: 'primary.main',
                    textDecoration: 'underline'
                  }
                }
              }}
              onClick={() => goToStage(stage)}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button
          variant="outlined"
          onClick={previousStage}
          disabled={currentIndex === 0}
        >
          Back
        </Button>

        <Button
          variant="contained"
          onClick={nextStage}
          disabled={!canProceed || currentIndex === stages.length - 1}
        >
          {currentIndex === stages.length - 2 ? 'Finish' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};
