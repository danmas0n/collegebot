import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useWizard } from '../../contexts/WizardContext';
import { useClaudeContext } from '../../contexts/ClaudeContext';

export const RecommendationsStage: React.FC = () => {
  const { data, currentStudent } = useWizard();
  const { apiKey, setApiKey, isConfigured } = useClaudeContext();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'thinking', content: string }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigureApiKey = () => {
    if (newApiKey.trim()) {
      setApiKey(newApiKey.trim());
      setIsConfiguring(false);
      setNewApiKey('');
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !apiKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          message: currentMessage,
          studentData: data,
          studentName: currentStudent?.name,
          history: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      const result = await response.json();
      
      // Add user message
      setMessages(prev => [...prev, { role: 'user', content: currentMessage }]);

      // Add thinking messages if available
      if (result.thinking) {
        for (const thought of result.thinking) {
          setMessages(prev => [...prev, { role: 'thinking', content: thought }]);
        }
      }

      // Add final response
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      
      setCurrentMessage('');
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <Paper elevation={0} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          AI Recommendations
        </Typography>
        <Typography color="text.secondary" paragraph>
          To get personalized recommendations, we need to configure your Claude API key.
        </Typography>
        <Button
          variant="contained"
          onClick={() => setIsConfiguring(true)}
        >
          Configure API Key
        </Button>

        <Dialog open={isConfiguring} onClose={() => setIsConfiguring(false)}>
          <DialogTitle>Configure Claude API Key</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Claude API Key"
              type="password"
              fullWidth
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleConfigureApiKey()}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsConfiguring(false)}>Cancel</Button>
            <Button
              onClick={handleConfigureApiKey}
              variant="contained"
              disabled={!newApiKey.trim()}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        AI Recommendations
      </Typography>
      <Typography color="text.secondary" paragraph>
        Ask questions about colleges that match your profile, or get recommendations based on your interests and budget. For example:
      </Typography>
      <Typography component="div" sx={{ mb: 2 }}>
        <ul>
          <li>"What colleges would be a good fit for me based on my GPA and test scores?"</li>
          <li>"Which colleges offer strong programs in my areas of interest?"</li>
          <li>"What are my chances of getting merit scholarships at these colleges?"</li>
          <li>"Compare the financial aid packages at these schools."</li>
        </ul>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3, maxHeight: '400px', overflowY: 'auto' }}>
        <List>
          {messages.map((msg, index) => (
            <ListItem
              key={index}
              sx={{
                bgcolor: msg.role === 'assistant' ? 'action.hover' : 
                       msg.role === 'thinking' ? 'grey.100' : 'transparent',
                borderRadius: 1,
                mb: 1,
                pl: msg.role === 'thinking' ? 4 : 2 // Indent thinking messages
              }}
            >
              <ListItemText
                primary={
                  msg.role === 'assistant' ? 'AI Assistant' : 
                  msg.role === 'thinking' ? 'Thinking...' : 'You'
                }
                secondary={msg.content}
                secondaryTypographyProps={{
                  style: { whiteSpace: 'pre-wrap' }
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          label="Ask a question"
          multiline
          rows={2}
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          disabled={isLoading}
        />
        <Button
          variant="contained"
          onClick={handleSendMessage}
          disabled={!currentMessage.trim() || isLoading}
          sx={{ minWidth: '100px' }}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Send'}
        </Button>
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={() => setIsConfiguring(true)}
        >
          Change API Key
        </Button>
      </Box>
    </Paper>
  );
};
