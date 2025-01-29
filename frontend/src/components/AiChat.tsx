import React, { useState, useRef, useCallback } from 'react';
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
import { useChat } from '../contexts/ChatContext';
import { CollapsibleMessage } from './CollapsibleMessage';
import { api } from '../utils/api';

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
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { apiKey, isConfigured, setApiKey } = useClaudeContext();
  const { currentStudent, data: studentData } = useWizard();
  const { currentChat, setCurrentChat } = useChat();
  const paperRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  // Cleanup function to handle unmounting during a request
  React.useEffect(() => {
    return () => {
      console.log('Frontend - Component unmounting');
      isMounted.current = false;
      if (abortController) {
        console.log('Frontend - Aborting request during unmount');
        abortController.abort();
        // Don't update state here since component is unmounting
      }
    };
  }, [abortController]);

  // Separate effect to handle abort controller cleanup
  React.useEffect(() => {
    if (!isLoading && abortController) {
      console.log('Frontend - Cleaning up abort controller after loading complete');
      setAbortController(null);
    }
  }, [isLoading, abortController]);

  const updateState = (updates: () => void) => {
    if (isMounted.current) {
      updates();
    }
  };

  const handleCancel = () => {
    if (abortController) {
      console.log('Frontend - Cancelling request');
      abortController.abort();
      
      // Group state updates to avoid race conditions
      updateState(() => {
        // First clear loading state and abort controller
        setIsLoading(false);
        setAbortController(null);

        // Then add cancellation message
        setMessages(prev => {
          const newMessages = prev.filter(msg => msg.role !== 'thinking');
          return [...newMessages, {
            role: 'system',
            content: 'Response cancelled by user.'
          }];
        });
      });
      
      console.log('Frontend - Request cancelled');
    }
  };
  
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

    updateState(() => {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
    });

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

      const controller = new AbortController();
      updateState(() => {
        setAbortController(controller);
      });
      
      const response = await api.post('/api/chat/claude/message', {
        message: input,
        studentData,
        studentName: currentStudent?.name || 'Student',
        history: messages,
        currentChat
      }, {
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
        }
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
                  updateState(() => {
                    setMessages(prev => {
                      // Replace the last message if it was also a thinking message
                      const newMessages = prev[prev.length - 1]?.role === 'thinking' 
                        ? [...prev.slice(0, -1), thinkingMessage]
                        : [...prev, thinkingMessage];
                      paperRef.current?.scrollTo({
                        top: paperRef.current.scrollHeight,
                        behavior: 'auto'
                      });
                      return newMessages;
                    });
                  });
                  break;

                case 'response':
                  console.log('Frontend - Adding answer message');
                  const answerMessage: AiChatMessage = {
                    role: 'answer',
                    content: data.content
                  };
                  updateState(() => {
                    setMessages(prev => {
                      // If the last message was a thinking message, replace it
                      // This handles the case where thinking and answer are part of the same response
                      const newMessages = prev[prev.length - 1]?.role === 'thinking'
                        ? [...prev.slice(0, -1), answerMessage]
                        : [...prev, answerMessage];
                      paperRef.current?.scrollTo({
                        top: paperRef.current.scrollHeight,
                        behavior: 'auto'
                      });
                      return newMessages;
                    });
                  });
                  break;

                case 'content_block_delta':
                  if (data.delta?.type === 'text_delta') {
                    console.log('Frontend - Received text delta:', data.delta.text);
                    currentMessage += data.delta.text;
                    
                    // Only update if we have accumulated non-tag content
                    if (currentMessage.trim() && 
                        !currentMessage.includes('<thinking>') &&
                        !currentMessage.includes('<answer>') &&
                        !currentMessage.includes('<tool>')) {
                      updateState(() => {
                        setMessages(prev => {
                          const lastMessage = prev[prev.length - 1];
                          // Update or add as thinking message
                          const updatedMessages = lastMessage?.role === 'thinking'
                            ? [...prev.slice(0, -1), { ...lastMessage, content: currentMessage }]
                            : [...prev, { role: 'thinking' as const, content: currentMessage }];
                          
                          paperRef.current?.scrollTo({
                            top: paperRef.current.scrollHeight,
                            behavior: 'auto'
                          });
                          
                          return updatedMessages;
                        });
                      });
                      // Clear buffer since we've handled this content
                      currentMessage = '';
                    }
                  }
                  break;

                case 'message_stop':
                  // Reset current message for next stream
                  currentMessage = '';
                  break;

                case 'complete':
                  console.log('Frontend - Received complete event');
                  console.log('Frontend - Current state:', {
                    isLoading,
                    hasAbortController: !!abortController,
                    messageCount: messages.length,
                    thinkingMessages: messages.filter(msg => msg.role === 'thinking').length
                  });
                  
                  updateState(() => {
                    setIsLoading(false);
                    setAbortController(null);
                  });

                  console.log('Frontend - State updates complete');
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
        console.log('Frontend - Stream ended, cleaning up');
        reader.releaseLock();
        // Ensure loading state is cleared when stream ends
        updateState(() => {
          setIsLoading(false);
          setAbortController(null);
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      updateState(() => {
        const errorMessage: AiChatMessage = {
          role: 'system',
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error while processing your request.',
        };
        setMessages(prev => [...prev, errorMessage]);
        // Ensure loading state is cleared on error
        setIsLoading(false);
        setAbortController(null);
      });
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
          ref={paperRef}
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
                <CollapsibleMessage 
                  message={message} 
                  isLatest={index === messages.length - 1 && isLoading}
                />
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
          {isLoading ? (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleCancel}
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSendMessage}
              disabled={!input.trim()}
              sx={{ minWidth: 100 }}
            >
              <SendIcon />
            </Button>
          )}
        </Box>
      </Box>
    </>
  );
};
