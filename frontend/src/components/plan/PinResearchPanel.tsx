import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';
import { useWizard } from '../../contexts/WizardContext';

interface PinResearchPanelProps {
  pinIds: string[];
  pinNames: string[];
  onResearchComplete?: () => void;
  onResearchError?: (error: string) => void;
}

export const PinResearchPanel: React.FC<PinResearchPanelProps> = ({
  pinIds,
  pinNames,
  onResearchComplete,
  onResearchError
}) => {
  const { currentStudent } = useWizard();
  const [isResearching, setIsResearching] = useState(false);
  const [researchComplete, setResearchComplete] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Handle research completion with countdown
  const handleResearchComplete = async () => {
    console.log('Pin research processing complete');
    setResearchComplete(true);
    setCountdown(10); // Start 10-second countdown
    onResearchComplete?.();
  };

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && researchComplete) {
      // Auto-collapse after countdown reaches 0
      console.log('Countdown finished, hiding research panel');
      setIsResearching(false);
      setResearchComplete(false);
    }
  }, [countdown, researchComplete]);

  const handleStartResearch = () => {
    setIsResearching(true);
    setResearchComplete(false);
  };

  const handleResearchError = (error: string) => {
    setIsResearching(false);
    setResearchComplete(false);
    onResearchError?.(error);
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Strategic College Application Planning
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Selected colleges: {pinNames.join(', ')}
      </Typography>
      
      {!isResearching ? (
        <Button
          variant="contained"
          color="primary"
          onClick={handleStartResearch}
          disabled={!currentStudent?.id || pinIds.length === 0}
        >
          Create Strategic Application Plan
        </Button>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Creating Strategic Application Plan
          </Typography>
          <StreamingChatInterface
            mode="processing"
            autoStart={true}
            processingEndpoint="/api/chat/strategic-planning"
            processingPayload={{
              studentId: currentStudent?.id,
              pinIds,
              pinNames
            }}
            onProcessingComplete={handleResearchComplete}
            onProcessingError={handleResearchError}
            title=""
            description=""
            operationType="calendar"
            llmOperationType="research"
            operationDescription={`Creating strategic application plan for ${pinNames.join(', ')}`}
          />
          {countdown > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                Research complete! Auto-hiding research panel in {countdown} seconds...
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};
