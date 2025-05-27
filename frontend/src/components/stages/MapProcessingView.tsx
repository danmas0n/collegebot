import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';

interface MapProcessingViewProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

export const MapProcessingView: React.FC<MapProcessingViewProps> = ({ onComplete, onError }) => {
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [finalSummary, setFinalSummary] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  const handleProcessingComplete = () => {
    setIsComplete(true);
    setFinalSummary('Processing complete! Successfully analyzed your chats and added new locations to your map.');
    setCountdown(10); // Start 10-second countdown
  };

  const handleViewMap = () => {
    onComplete();
  };

  // Auto-refresh countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && isComplete) {
      // Auto-refresh after countdown reaches 0
      onComplete();
    }
  }, [countdown, isComplete, onComplete]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Streaming Chat Interface */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <StreamingChatInterface
          mode="processing"
          autoStart={true}
          processingEndpoint="/api/chat/process-all"
          onProcessingComplete={handleProcessingComplete}
          onProcessingError={onError}
          title="Processing College Information"
          description="Analyzing your conversations to extract colleges and scholarships for your map..."
          operationType="map"
          llmOperationType="map-processing"
          operationDescription="Processing chats to extract map locations"
        />
      </Box>

      {/* Final Summary and Actions */}
      {isComplete && (
        <Paper sx={{ p: 3, mt: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <Typography variant="h6" gutterBottom>
            🎉 Processing Complete!
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {finalSummary}
          </Typography>
          {countdown > 0 && (
            <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
              Automatically returning to map in {countdown} seconds...
            </Typography>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleViewMap}
            size="large"
          >
            View Updated Map
          </Button>
        </Paper>
      )}
    </Box>
  );
};
