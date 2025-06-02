import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Button,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';
import { useWizard } from '../../contexts/WizardContext';

interface CollapsibleResearchInterfaceProps {
  pinIds: string[];
  pinNames: string[];
  onResearchComplete?: () => void;
  onResearchError?: (error: string) => void;
}

export const CollapsibleResearchInterface: React.FC<CollapsibleResearchInterfaceProps> = ({
  pinIds,
  pinNames,
  onResearchComplete,
  onResearchError
}) => {
  const { currentStudent } = useWizard();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [researchStatus, setResearchStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const handleStartResearch = () => {
    if (!currentStudent?.id || pinIds.length === 0) return;
    
    setHasStarted(true);
    setIsResearching(true);
    setResearchStatus('running');
    setError(null);
    
    // Auto-expand when research starts
    setIsExpanded(true);
  };
  
  const handleResearchCompleteInternal = () => {
    setIsResearching(false);
    setResearchStatus('complete');
    // Auto-collapse when complete to show summary
    setIsExpanded(false);
    onResearchComplete?.();
  };
  
  const handleResearchErrorInternal = (errorMessage: string) => {
    setIsResearching(false);
    setResearchStatus('error');
    setError(errorMessage);
    onResearchError?.(errorMessage);
  };
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  const getStatusColor = () => {
    switch (researchStatus) {
      case 'running': return 'primary';
      case 'complete': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };
  
  const getStatusText = () => {
    switch (researchStatus) {
      case 'running': return 'Researching...';
      case 'complete': return 'Research Complete';
      case 'error': return 'Research Failed';
      default: return 'Ready to Research';
    }
  };
  
  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      {/* Header - Always Visible */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: researchStatus === 'complete' ? 'success.light' : 
                researchStatus === 'error' ? 'error.light' : 
                researchStatus === 'running' ? 'primary.light' : 'background.paper',
        color: researchStatus !== 'idle' ? 'white' : 'inherit'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Typography variant="h6">
            Pin Research
          </Typography>
          
          <Chip 
            label={getStatusText()} 
            color={getStatusColor()}
            size="small"
            icon={isResearching ? <CircularProgress size={16} color="inherit" /> : undefined}
          />
          
          {pinNames.length > 0 && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {pinNames.join(', ')}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!hasStarted && (
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartResearch}
              disabled={!currentStudent?.id || pinIds.length === 0}
              size="small"
            >
              Start Research
            </Button>
          )}
          
          {hasStarted && (
            <IconButton
              onClick={toggleExpanded}
              sx={{ 
                color: researchStatus !== 'idle' ? 'white' : 'inherit',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease'
              }}
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2, mt: 0 }}>
          {error}
        </Alert>
      )}
      
      {/* Expandable Content */}
      <Collapse in={isExpanded && hasStarted}>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          {hasStarted && (
            <StreamingChatInterface
              mode="processing"
              autoStart={true}
              processingEndpoint="/api/pin-research-stream/stream"
              processingPayload={{
                studentId: currentStudent?.id,
                pinIds,
                pinNames
              }}
              onProcessingComplete={handleResearchCompleteInternal}
              onProcessingError={handleResearchErrorInternal}
              title=""
              description=""
              operationType="calendar"
              llmOperationType="research"
              operationDescription={`Researching ${pinNames.join(', ')} and creating application plan`}
            />
          )}
        </Box>
      </Collapse>
      
      {/* Minimized Summary */}
      {hasStarted && !isExpanded && (
        <Box 
          sx={{ 
            p: 2, 
            pt: 0, 
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
          onClick={toggleExpanded}
        >
          <Typography variant="body2" color="text.secondary">
            {researchStatus === 'running' && 'AI is researching colleges and creating your application plan... Click to view details.'}
            {researchStatus === 'complete' && 'Research complete! Application plan has been created. Click to view details.'}
            {researchStatus === 'error' && 'Research encountered an error. Click to view details.'}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
