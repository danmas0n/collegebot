import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Collapse, 
  IconButton, 
  LinearProgress,
  CircularProgress,
  Alert
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { CalendarView } from '../calendar/CalendarView';
import { useChat } from '../../contexts/ChatContext';
import { useWizard } from '../../contexts/WizardContext';
import { api } from '../../utils/api';

interface CalendarStageProps {
  studentId?: string;
}

export const CalendarStage: React.FC<CalendarStageProps> = ({ studentId }) => {
  const { currentStudent } = useWizard();
  const { chats, loadChats } = useChat();
  const [showDebugControls, setShowDebugControls] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingTotal, setProcessingTotal] = useState<number>(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [showProcessingLogs, setShowProcessingLogs] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use the studentId from props if provided, otherwise use the currentStudent's id
  const effectiveStudentId = studentId || currentStudent?.id;
  
  // Function to process all chats
  const handleProcessAllChats = async () => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      setProcessingStatus('Processing chats...');
      setProcessingLogs([]);
      
      const response = await api.post('/api/chat/process-all', {
        studentId: currentStudent.id
      }, { stream: true });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader');
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(5)); // Remove 'data: '
            
            if (data.type === 'thinking') {
              setProcessingLogs(prev => [...prev, data.content]);
            } else if (data.type === 'status') {
              setProcessingStatus(data.content);
              if (data.total) setProcessingTotal(data.total);
              if (data.progress) setProcessingProgress(data.progress);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error processing chats:', err);
      setError('Failed to process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to mark all chats as unprocessed
  const handleMarkChatsUnprocessed = async () => {
    if (!currentStudent?.id || !chats?.length) return;
    
    try {
      setIsProcessing(true);
      setProcessingStatus('Marking chats as unprocessed...');
      
      await api.post('/api/chat/mark-unprocessed', {
        studentId: currentStudent.id,
        chatIds: chats.map(chat => chat.id)
      });
      
      // Reload chats
      await loadChats(currentStudent.id);
      
      setProcessingStatus('Chats marked as unprocessed');
    } catch (err) {
      console.error('Error marking chats as unprocessed:', err);
      setError('Failed to mark chats as unprocessed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          Calendar & Tasks
        </Typography>
        <IconButton
          onClick={() => setShowDebugControls(!showDebugControls)}
          size="small"
        >
          <SettingsIcon />
        </IconButton>
      </Box>
      
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Collapse in={showDebugControls}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Debug Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcessAllChats}
              disabled={isProcessing || !currentStudent}
            >
              Process All Chats
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleMarkChatsUnprocessed}
              disabled={isProcessing || !currentStudent}
            >
              Mark All Chats Unprocessed
            </Button>
          </Box>
          
          {/* Processing status and logs */}
          {isProcessing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">{processingStatus}</Typography>
              <LinearProgress 
                variant={processingTotal > 0 ? "determinate" : "indeterminate"} 
                value={processingTotal > 0 ? (processingProgress / processingTotal) * 100 : 0}
                sx={{ my: 1 }}
              />
              <Collapse in={showProcessingLogs}>
                <Paper variant="outlined" sx={{ p: 1, mt: 1, maxHeight: 200, overflow: 'auto' }}>
                  {processingLogs.map((log, index) => (
                    <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {log}
                    </Typography>
                  ))}
                </Paper>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button 
                    size="small"
                    onClick={() => setShowProcessingLogs(!showProcessingLogs)}
                    startIcon={showProcessingLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {showProcessingLogs ? 'Hide' : 'Show'} Logs
                  </Button>
                </Box>
              </Collapse>
            </Box>
          )}
        </Paper>
      </Collapse>
      
      {effectiveStudentId ? (
        <CalendarView studentId={effectiveStudentId} />
      ) : (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Please select a student to view the calendar.
        </Typography>
      )}
    </Box>
  );
};
