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

      console.log('Frontend - Sending request with API key:', apiKey.substring(0, 4) + '...');
      console.log('Frontend - isConfigured:', isConfigured);
      console.log('Frontend - Request payload:', {
        message: input,
        studentName: currentStudent?.name || 'Student',
        historyLength: messages.length
      });

      const response = await fetch('/api/chat/claude', {
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

      console.log('Frontend - Response status:', response.status);
      console.log('Frontend - Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        throw new Error(`Failed to get AI response: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            try {
              console.log('Frontend - Received SSE line:', line);
              const data = JSON.parse(line.slice(6));
              console.log('Frontend - Parsed SSE data:', data);

              console.log('Frontend - Processing event:', data);
              switch (data.type) {
                case 'message_start':
                  console.log('Frontend - Starting new message');
                  currentMessage = '';
                  break;

                case 'thinking':
                  console.log('Frontend - Adding thinking message');
                  const thinkingMessage: AiChatMessage = {
                    role: 'thinking',
                    content: data.content + (data.toolData ? `\n\nTool Data:\n${data.toolData}` : '')
                  };
                  setMessages(prev => [...prev, thinkingMessage]);
                  break;

                case 'content_block_delta':
                  if (data.delta?.type === 'text_delta') {
                    console.log('Frontend - Received text delta:', data.delta.text);
                    currentMessage += data.delta.text;
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.role === 'assistant') {
                        console.log('Frontend - Updating existing assistant message');
                        return [
                          ...newMessages.slice(0, -1),
                          { ...lastMessage, content: currentMessage }
                        ];
                      } else {
                        console.log('Frontend - Creating new assistant message');
                        return [...newMessages, {
                          role: 'assistant',
                          content: currentMessage
                        }];
                      }
                    });
                  }
                  break;

                case 'message_stop':
                  // Reset current message for next stream
                  currentMessage = '';
                  break;

                case 'error':
                  throw new Error(data.content);
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
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
                    message.role === 'user' ? 'primary.main' : 
                    message.role === 'thinking' ? 'grey.100' : 'background.paper',
                  color: message.role === 'user' ? 'white' : 'text.primary',
                  pl: message.role === 'thinking' ? 4 : 2 // Indent thinking messages
                  }}
                >
                  <Typography sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: message.content.includes('Tool Data:') ? 'monospace' : 'inherit',
                    fontSize: message.content.includes('Tool Data:') ? '0.85em' : 'inherit'
                  }}>
                    {message.content}
                  </Typography>
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
