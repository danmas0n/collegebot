import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useChat } from '../../contexts/ChatContext';
import { useNotification } from '../../contexts/NotificationContext';
import { StageContainer, StageHeader } from './StageContainer';
import TipsAdvicePanel from '../calendar/TipsAdvicePanel';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';

import { AiChat } from '../../types/college';

interface Chat extends AiChat {
  toolData?: string;
}

export const RecommendationsStage: React.FC = () => {
  const { currentStudent, data } = useWizard();
  const { chats, currentChat, loadChats, setCurrentChat } = useChat();
  const [error, setError] = useState<string | null>(null);
  const hasLoadedChats = useRef(false);

  // State for tabs
  const [activeTab, setActiveTab] = useState<number>(0);

  // Load chats when component mounts or student changes
  useEffect(() => {
    if (currentStudent?.id && !hasLoadedChats.current) {
      hasLoadedChats.current = true;
      loadChats(currentStudent.id).then(loadedChats => {
        // Only set a default chat if no chat is currently selected (not coming from deep link)
        if (!currentChat && loadedChats.length > 0) {
          // Select the most recent chat
          const mostRecentChat = loadedChats[loadedChats.length - 1];
          setCurrentChat(mostRecentChat);
        }
      });
    }
  }, [currentStudent?.id]); // Only depend on currentStudent.id

  // Reset the hasLoadedChats flag when student changes
  useEffect(() => {
    hasLoadedChats.current = false;
  }, [currentStudent?.id]);

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
    
    setCurrentChat(newChat);
    return newChat;
  };

  const handleChatChange = (chat: Chat) => {
    setCurrentChat(chat);
  };

  const handleNewChat = () => {
    const newChat = createNewChat();
    return newChat;
  };

  const handleChatUpdate = useCallback((updatedChat: Chat) => {
    // The ChatContext will handle updating the chats array
    setCurrentChat(updatedChat);
  }, [setCurrentChat]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!currentStudent?.id) return;
    
    try {
      // Use the ChatContext deleteChat method
      // Note: We'll need to add this to ChatContext if it doesn't exist
      // For now, we'll handle it locally and update the context
      const response = await fetch(`/api/chat/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: currentStudent.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      // Reload chats to update the context
      await loadChats(currentStudent.id);
      
      // Clear current chat if it was the deleted one
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete chat');
    }
  }, [currentStudent?.id, currentChat, loadChats, setCurrentChat]);

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
              onDeleteChat={handleDeleteChat}
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
