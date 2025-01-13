import React, { useState, useEffect } from 'react';
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
  Grid,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useWizard } from '../../contexts/WizardContext';
import { useClaudeContext } from '../../contexts/ClaudeContext';
import { AiChatMessage } from '../../types/college';
import { CollapsibleMessage } from '../CollapsibleMessage';

interface Message extends AiChatMessage {
  timestamp: string;
  toolData?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  studentId?: string;
}

export const RecommendationsStage: React.FC = () => {
  const { data, currentStudent } = useWizard();
  const { apiKey, setApiKey, isConfigured } = useClaudeContext();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantMessageBuffer, setAssistantMessageBuffer] = useState('');

  // Load chats when component mounts or student changes
  useEffect(() => {
    if (currentStudent?.id) {
      loadChats().then(loadedChats => {
        if (loadedChats.length === 0) {
          // Create a new chat if there are none
          const newChat = createNewChat();
          setCurrentChat(newChat);
        } else {
          // Select the most recent chat
          setCurrentChat(loadedChats[loadedChats.length - 1]);
        }
      });
    }
  }, [currentStudent?.id]);

  const loadChats = async (): Promise<Chat[]> => {
    try {
      const response = await fetch('/api/chat/claude/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        },
        body: JSON.stringify({
          studentId: currentStudent?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load chats');
      }

      const data = await response.json();
      const loadedChats = data.chats;
      setChats(loadedChats);
      return loadedChats;
    } catch (error) {
      console.error('Error loading chats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chats');
      return []; // Return empty array on error
    }
  };

  const createNewChat = (): Chat => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studentId: currentStudent?.id
    };
    const updatedChats = [...chats, newChat];
    setChats(updatedChats);
    setCurrentChat(newChat);
    return newChat;
  };

  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch('/api/chat/claude/chat', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        },
        body: JSON.stringify({
          studentId: currentStudent?.id,
          chatId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      setChats(prev => prev.filter(c => c.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete chat');
    }
  };

  const saveChat = async (chat: Chat) => {
    try {
      const response = await fetch('/api/chat/claude/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        },
        body: JSON.stringify({
          studentId: currentStudent?.id,
          chat
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save chat');
      }
    } catch (error) {
      console.error('Error saving chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to save chat');
    }
  };

  const handleConfigureApiKey = () => {
    if (newApiKey.trim()) {
      setApiKey(newApiKey.trim());
      setIsConfiguring(false);
      setNewApiKey('');
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !apiKey) return;

    let activeChat: Chat;
    if (!currentChat) {
      activeChat = createNewChat();
      await new Promise(resolve => setTimeout(resolve, 0)); // Let state update
    } else {
      activeChat = currentChat;
    }

    setIsLoading(true);
    setError(null);
    setAssistantMessageBuffer('');

    try {
      // Add user message immediately
      const userMessage: Message = {
        role: 'user',
        content: currentMessage,
        timestamp: new Date().toISOString()
      };

      // Save initial user message
      const updatedChat: Chat = {
        ...activeChat,
        messages: [...activeChat.messages, userMessage],
        updatedAt: new Date().toISOString(),
        studentId: currentStudent?.id
      };
      setCurrentChat(updatedChat);
      activeChat = updatedChat; // Update activeChat reference
      await saveChat(updatedChat);

      const response = await fetch('/api/chat/claude/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          message: currentMessage,
          studentData: {
            ...data,
            id: currentStudent?.id
          },
          studentName: currentStudent?.name,
          history: updatedChat.messages,
          currentChat: updatedChat
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Claude');
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentThinkingMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(5)); // Remove 'data: '

              switch (data.type) {
                case 'thinking':
                  if (data.toolData) {
                    // Tool-related message
                    const thinkingMessage: Message = {
                      role: 'thinking',
                      content: data.content + (data.toolData ? `\n\nTool Data:\n${data.toolData}` : ''),
                      timestamp: new Date().toISOString()
                    };
                    const updatedChat: Chat = {
                      ...activeChat,
                      messages: [...activeChat.messages, thinkingMessage],
                      updatedAt: new Date().toISOString(),
                      studentId: currentStudent?.id
                    };
                    setCurrentChat(updatedChat);
                    activeChat = updatedChat;
                    currentThinkingMessage = '';
                  } else {
                    // Regular thinking update
                    if (currentThinkingMessage) {
                      const updatedChat: Chat = {
                        ...activeChat,
                        messages: activeChat.messages.map((msg, i) => 
                          i === activeChat.messages.length - 1 && msg.role === 'thinking'
                            ? { ...msg, content: msg.content + data.content }
                            : msg
                        ),
                        updatedAt: new Date().toISOString(),
                        studentId: currentStudent?.id
                      };
                      setCurrentChat(updatedChat);
                      activeChat = updatedChat;
                    } else {
                      const thinkingMessage: Message = {
                        role: 'thinking',
                        content: data.content,
                        timestamp: new Date().toISOString()
                      };
                      const updatedChat: Chat = {
                        ...activeChat,
                        messages: [...activeChat.messages, thinkingMessage],
                        updatedAt: new Date().toISOString(),
                        studentId: currentStudent?.id
                      };
                      setCurrentChat(updatedChat);
                      activeChat = updatedChat;
                      currentThinkingMessage = data.content;
                    }
                  }
                  break;

                case 'content_block_delta':
                  if (data.delta.type === 'text_delta') {
                    // Accumulate text
                    setAssistantMessageBuffer(prev => prev + data.delta.text);
                    
                    // Update UI with thinking message
                    const thinkingMessage: Message = {
                      role: 'thinking',
                      content: assistantMessageBuffer + data.delta.text,
                      timestamp: new Date().toISOString()
                    };
                    const updatedChat: Chat = {
                      ...activeChat,
                      messages: [
                        ...activeChat.messages,
                        thinkingMessage
                      ],
                      updatedAt: new Date().toISOString(),
                      studentId: currentStudent?.id
                    };
                    setCurrentChat(updatedChat);
                    activeChat = updatedChat;
                  }
                  break;

                case 'message_stop':
                  // Keep all messages including thinking messages
                  const updatedChat: Chat = {
                    ...activeChat,
                    updatedAt: new Date().toISOString(),
                    studentId: currentStudent?.id
                  };
                  setCurrentChat(updatedChat);
                  activeChat = updatedChat;
                  await saveChat(updatedChat);
                  setIsLoading(false);
                  break;

                case 'response':
                  console.log('Frontend - Received response event');
                  const answerMessage: Message = {
                    role: 'answer',
                    content: data.content,
                    timestamp: new Date().toISOString()
                  };
                  const updatedChatWithAnswer: Chat = {
                    ...activeChat,
                    messages: [...activeChat.messages, answerMessage],
                    updatedAt: new Date().toISOString(),
                    studentId: currentStudent?.id
                  };
                  setCurrentChat(updatedChatWithAnswer);
                  activeChat = updatedChatWithAnswer;
                  break;

                case 'complete':
                  console.log('Frontend - Received complete event');
                  setIsLoading(false);
                  await saveChat(activeChat);
                  break;

                case 'error':
                  setError(data.content);
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      setCurrentMessage('');
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (msg: Message, index: number) => {
    // If message has tool data, combine it with the content
    const messageContent = msg.toolData 
      ? `${msg.content}\n\nTool Data:\n${msg.toolData}`
      : msg.content;

    return (
      <Grid container spacing={2} key={index}>
        <Grid item xs={12}>
          <CollapsibleMessage 
            message={{ ...msg, content: messageContent }}
            isLatest={index === (currentChat?.messages?.length ?? 0) - 1 && isLoading}
          />
        </Grid>
      </Grid>
    );
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

      <Grid container spacing={2}>
        {/* Chat List */}
        <Grid item xs={3}>
          <Paper elevation={0} sx={{ p: 2, height: '100%' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Chats</Typography>
              <Button
                variant="contained"
                size="small"
                onClick={createNewChat}
              >
                New Chat
              </Button>
            </Box>
            <List>
              {chats.map((chat) => (
                <ListItem
                  key={chat.id}
                  sx={{ cursor: 'pointer' }}
                  selected={currentChat?.id === chat.id}
                  onClick={() => {
                    console.log('Selecting chat:', chat.id);
                    setCurrentChat(chat);
                  }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => deleteChat(chat.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={chat.title}
                    secondary={new Date(chat.updatedAt).toLocaleDateString()}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Chat Messages */}
        <Grid item xs={9}>
          <Box sx={{ mb: 3, height: '400px', overflowY: 'auto' }}>
            <List>
              {currentChat?.messages.map((msg, index) => renderMessage(msg, index))}
            </List>
          </Box>
        </Grid>
      </Grid>

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
