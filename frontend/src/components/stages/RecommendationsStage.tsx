import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Grid,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useWizard } from '../../contexts/WizardContext';
import { AiChatMessage } from '../../types/college';
import { CollapsibleMessage } from '../CollapsibleMessage';
import { api } from '../../utils/api';

interface Message extends AiChatMessage {
  timestamp: string;
  toolData?: string;
}

import { AiChat } from '../../types/college';

interface Chat extends AiChat {
  toolData?: string;
}

export const RecommendationsStage: React.FC = () => {
  const { data, currentStudent } = useWizard();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantMessageBuffer, setAssistantMessageBuffer] = useState('');
  const paperRef = React.useRef<HTMLDivElement>(null);

  // Load chats when component mounts or student changes
  useEffect(() => {
    if (currentStudent?.id) {
      loadChats().then(loadedChats => {
        if (loadedChats.length === 0) {
          // If there are no chats, populate the text field with a default message
          setCurrentMessage("What are a few colleges and/or scholarships that might be good fits for me?");
        } else {
          // Select the most recent chat
          const mostRecentChat = loadedChats[loadedChats.length - 1];
          setCurrentChat(mostRecentChat);
        }
      });
    }
  }, [currentStudent?.id]);

  const loadChats = async (): Promise<Chat[]> => {
    if (!currentStudent?.id) {
      return [];
    }

    try {
      const response = await api.post('/api/chat/chats', {
        studentId: currentStudent.id
      });

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

  const createNewChat = (): Chat | null => {
    if (!currentStudent?.id) {
      return null;
    }

    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studentId: currentStudent.id,
      processed: false,
      processedAt: null
    };
    const updatedChats = [...chats, newChat];
    setChats(updatedChats);
    setCurrentChat(newChat);
    return newChat;
  };

  const deleteChat = async (chatId: string) => {
    try {
      await api.delete(`/api/chat/chats/${chatId}`, {
        body: JSON.stringify({
          studentId: currentStudent?.id
        })
      });

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
      console.log('Frontend - Saving chat:', { chatId: chat.id, title: chat.title, studentId: chat.studentId });
      await api.post('/api/chat/chat', {
        studentId: currentStudent?.id,
        chat
      });
      console.log('Frontend - Chat saved successfully');
      
      // Refresh the chat list to show updated titles
      const loadedChats = await loadChats();
      // Keep the current chat selected after refresh
      const refreshedCurrentChat = loadedChats.find(c => c.id === chat.id);
      if (refreshedCurrentChat) {
        setCurrentChat(refreshedCurrentChat);
      }
    } catch (error) {
      console.error('Frontend - Error saving chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to save chat');
    }
  };

  const handleSendMessage = async (messageContent?: string) => {
    if (!currentStudent?.id) return;
    
    const message = messageContent || currentMessage;
    if (!message.trim()) return;

    let activeChat: Chat;
    if (!currentChat) {
      const newChat = createNewChat();
      if (!newChat) return;
      activeChat = newChat;
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
        content: message,
        timestamp: new Date().toISOString()
      };

      // Save initial user message
      const updatedChat: Chat = {
        ...activeChat,
        messages: [...activeChat.messages, userMessage],
        updatedAt: new Date().toISOString(),
        studentId: currentStudent.id
      };
      setCurrentChat(updatedChat);
      activeChat = updatedChat; // Update activeChat reference
      await saveChat(updatedChat);

      // Clear input field after message is saved
      const messageToSend = message;
      setCurrentMessage('');

      // Find index of last user message before current one
      const lastUserMessageIndex = updatedChat.messages
        .slice(0, -1) // Exclude current message
        .map((msg, i) => ({ msg, i }))
        .filter(({ msg }) => msg.role === 'user')
        .pop()?.i;

      // Filter messages for AI service
      const filteredMessages = updatedChat.messages
        // Group messages by exchange (between user messages)
        .reduce<Message[]>((acc, msg, i) => {
          if (msg.role === 'user') {
            // Always keep user messages
            acc.push(msg);
          } else if (msg.role === 'answer' || msg.role === 'question') {
            // For answer/question messages, replace any previous answer/question
            // in the current exchange
            const lastMsg = acc[acc.length - 1];
            if (lastMsg && lastMsg.role !== 'user') {
              acc[acc.length - 1] = msg;
            } else {
              acc.push(msg);
            }
          }
          return acc;
        }, [])
        // Map to AI service format
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      const response = await api.post('/api/chat/message', {
          message: messageToSend,
          studentData: {
            ...data,
            id: currentStudent.id
          },
          studentName: currentStudent.name || 'Student',
          history: filteredMessages,
          currentChat: updatedChat
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let currentThinkingMessage = '';
      let hasToolCalls = false;
      let messageContent = '';

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
                    hasToolCalls = true;
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
                    // Accumulate text for potential question
                    messageContent += data.delta.text;
                    
                    // Update UI with thinking message
                    const thinkingMessage: Message = {
                      role: 'thinking',
                      content: messageContent,
                      timestamp: new Date().toISOString()
                    };
                    const updatedChat: Chat = {
                      ...activeChat,
                      messages: [
                        ...activeChat.messages.filter(msg => msg.role !== 'thinking'),
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
                  // If no tool calls were made, treat the accumulated content as a question
                  if (!hasToolCalls && messageContent.trim()) {
                    const questionMessage: Message = {
                      role: 'question',
                      content: messageContent,
                      timestamp: new Date().toISOString()
                    };
                    const updatedChatWithQuestion: Chat = {
                      ...activeChat,
                      messages: [
                        ...activeChat.messages.filter(msg => msg.role !== 'thinking'),
                        questionMessage
                      ],
                      updatedAt: new Date().toISOString(),
                      studentId: currentStudent?.id
                    };
                    setCurrentChat(updatedChatWithQuestion);
                    activeChat = updatedChatWithQuestion;
                  }
                  await saveChat(activeChat);
                  setIsLoading(false);
                  break;

                case 'response':
                  console.log('Frontend - Received response event');
                  const answerMessage: Message = {
                    role: 'answer',
                    content: data.content,
                    timestamp: new Date().toISOString()
                  };
                  
                  // If this is the first answer in the chat and we have a suggested title
                  if (data.suggestedTitle && activeChat.messages.filter(m => m.role === 'answer').length === 0) {
                    activeChat = {
                      ...activeChat,
                      title: data.suggestedTitle
                    };
                  }
                  
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

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (paperRef.current && currentChat?.messages.length) {
      const scrollElement = paperRef.current;
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      });
    }
  }, [currentChat?.messages]);

  return (
    <Paper elevation={0} sx={{ p: 3, height: '100%' }}>
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

      <Grid container spacing={2} sx={{ height: 'calc(100vh - 250px)' }}>
        {/* Chat List */}
        <Grid item xs={3} sx={{ height: '100%' }}>
          <Paper elevation={0} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
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
        <Grid item xs={9} sx={{ height: '100%' }}>
          <Box 
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box 
              sx={{ 
                flex: 1,
                overflowY: 'auto',
                width: '100%',
                mb: 2
              }}
              ref={paperRef}
            >
              <List sx={{ width: '100%' }}>
                {currentChat?.messages.map((msg, index) => renderMessage(msg, index))}
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
                onClick={() => handleSendMessage(currentMessage)}
                disabled={!currentMessage.trim() || isLoading}
                sx={{ minWidth: '100px' }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Send'}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};
