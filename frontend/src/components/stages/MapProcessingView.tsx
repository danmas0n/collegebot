import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
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
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingTotal, setProcessingTotal] = useState<number>(0);

  const handleProcessingComplete = () => {
    setIsComplete(true);
    setFinalSummary('Processing complete! Successfully analyzed your chats and added new locations to your map.');
  };

  const handleViewMap = () => {
    onComplete();
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Progress Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            {isComplete ? 'Processing Complete!' : 'Processing Status'}
          </Typography>
          {isComplete && <CheckCircleIcon color="success" />}
        </Box>
        
        <Typography variant="body2" sx={{ mb: 2 }}>
          {processingStatus || 'Initializing...'}
        </Typography>
        
        <LinearProgress 
          variant={processingTotal > 0 ? "determinate" : "indeterminate"} 
          value={processingTotal > 0 ? (processingProgress / processingTotal) * 100 : 0}
          sx={{ mb: 1 }}
        />
        
        {processingTotal > 0 && (
          <Typography variant="caption" color="text.secondary">
            {processingProgress} of {processingTotal} chats processed
          </Typography>
        )}
      </Paper>

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
