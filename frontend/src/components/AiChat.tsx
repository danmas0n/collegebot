import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  List,
  ListItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { College, AiChatMessage } from '../types/college';
import { useClaudeContext } from '../contexts/ClaudeContext';
import { useWizard } from '../contexts/WizardContext';

interface AiChatProps {
  consideredColleges: College[];
}

interface ClaudeResponse {
  response: string;
}

export const AiChat: React.FC<AiChatProps> = ({ consideredColleges }) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { apiKey, isConfigured, setApiKey } = useClaudeContext();
  const { currentStudent, data: studentData } = useWizard();
  
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(!isConfigured);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setShowApiKeyDialog(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: AiChatMessage = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!isConfigured || !apiKey) {
        throw new Error('Claude API key not configured');
      }

      console.log('Sending request with API key:', apiKey.substring(0, 4) + '...');
      console.log('isConfigured:', isConfigured);

      const response: Response = await fetch('/api/chat/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          message: input,
          studentData,
          studentName: currentStudent?.name || 'Student',
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const responseData: ClaudeResponse = await response.json();
      const aiMessage: AiChatMessage = {
        role: 'assistant',
        content: responseData.response,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: AiChatMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error while processing your request.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={showApiKeyDialog} onClose={() => {}}>
        <DialogTitle>Configure Claude API Key</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please enter your Claude API key to enable AI chat functionality.
          </Typography>
          <TextField
            fullWidth
            label="Claude API Key"
            variant="outlined"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            type="password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSaveApiKey} variant="contained" disabled={!apiKeyInput}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>
          Ask about your colleges
        </Typography>
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            mb: 2,
            p: 2,
            backgroundColor: 'grey.100',
            overflowY: 'auto',
            maxHeight: '60vh',
          }}
        >
          <List>
            {messages.map((message, index) => (
              <ListItem
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1,
                }}
              >
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    maxWidth: '80%',
                    backgroundColor:
                      message.role === 'user' ? 'primary.main' : 'background.paper',
                    color: message.role === 'user' ? 'white' : 'text.primary',
                  }}
                >
                  <Typography>{message.content}</Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        </Paper>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Ask about your considered colleges..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={isLoading}
            sx={{ minWidth: 100 }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <>
                <SendIcon />
              </>
            )}
          </Button>
        </Box>
      </Box>
    </>
  );
};
