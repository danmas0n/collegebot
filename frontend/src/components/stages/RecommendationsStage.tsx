import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Collapse,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import { useWizard } from '../../contexts/WizardContext';
import { useNotification } from '../../contexts/NotificationContext';
import { StageContainer, StageHeader } from './StageContainer';
import TipsAdvicePanel from '../calendar/TipsAdvicePanel';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';
import { api } from '../../utils/api';

import { AiChat } from '../../types/college';

interface Chat extends AiChat {
  toolData?: string;
}

export const RecommendationsStage: React.FC = () => {
  const { currentStudent, data } = useWizard();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State for tabs
  const [activeTab, setActiveTab] = useState<number>(0);

  // Load chats when component mounts or student changes
  useEffect(() => {
    if (currentStudent?.id) {
      loadChats().then(loadedChats => {
        if (loadedChats.length > 0) {
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

  const handleChatChange = (chat: Chat) => {
    setCurrentChat(chat);
  };

  const handleNewChat = () => {
    const newChat = createNewChat();
    if (newChat) {
      setCurrentChat(newChat);
    }
    return newChat;
  };

  const handleChatUpdate = useCallback((updatedChat: Chat) => {
    setChats(prev => prev.map(chat => 
      chat.id === updatedChat.id ? updatedChat : chat
    ));
    setCurrentChat(prev => 
      prev?.id === updatedChat.id ? updatedChat : prev
    );
  }, []); // Remove dependency to prevent recreation

  const { showNotification } = useNotification();
  const [showExamples, setShowExamples] = useState(true);
  
  // Auto-collapse examples after 5 seconds
  useEffect(() => {
    if (showExamples) {
      const timer = setTimeout(() => {
        setShowExamples(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showExamples]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <StageContainer elevation={0} sx={{ position: 'relative' }}>
      <StageHeader>
        <Typography variant="h5" gutterBottom>
          AI Recommendations
        </Typography>

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            aria-label="recommendations tabs"
          >
            <Tab label="Chat & Recommendations" />
            <Tab 
              label="Tips & Advice" 
              icon={<TipsAndUpdatesIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Chat Tab Content */}
        {activeTab === 0 && (
          <>
            <Collapse in={showExamples}>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography color="text.secondary">
                    Example questions you can ask:
                  </Typography>
                  <IconButton size="small" onClick={() => setShowExamples(false)}>
                    <ExpandLessIcon />
                  </IconButton>
                </Box>
                <Typography component="div">
                  <ul>
                    <li>"What colleges would be a good fit for me based on my GPA and test scores?"</li>
                    <li>"Which colleges offer strong programs in my areas of interest?"</li>
                    <li>"What are my chances of getting merit scholarships at these colleges?"</li>
                    <li>"Compare the financial aid packages at these schools."</li>
                  </ul>
                </Typography>
              </Box>
            </Collapse>

            {!showExamples && (
              <Button
                startIcon={<ExpandMoreIcon />}
                onClick={() => setShowExamples(true)}
                sx={{ mb: 2 }}
              >
                Show Example Questions
              </Button>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </StageHeader>

      {/* Tab Panel Content */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Chat Tab */}
        <Box role="tabpanel" hidden={activeTab !== 0} sx={{ height: '100%' }}>
          {activeTab === 0 && (
            <StreamingChatInterface
              mode="chat"
              chats={chats}
              currentChat={currentChat}
              onChatChange={handleChatChange}
              onNewChat={handleNewChat}
              onDeleteChat={deleteChat}
              onChatUpdate={handleChatUpdate}
              showInput={true}
              wizardData={data}
              operationType="recommendations"
              llmOperationType="chat"
              operationDescription="Chat conversation"
            />
          )}
        </Box>

        {/* Tips & Advice Tab */}
        <Box role="tabpanel" hidden={activeTab !== 1} sx={{ height: '100%', overflowY: 'auto' }}>
          {activeTab === 1 && (
            <TipsAdvicePanel />
          )}
        </Box>
      </Box>
    </StageContainer>
  );
};
