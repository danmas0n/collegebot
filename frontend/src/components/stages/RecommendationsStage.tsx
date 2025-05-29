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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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
    <StageContainer sx={{ position: 'relative' }}>
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
            <Tab 
              label="Example Questions" 
              icon={<HelpOutlineIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Error Alert for Chat Tab */}
        {activeTab === 0 && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
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

        {/* Example Questions Tab */}
        <Box role="tabpanel" hidden={activeTab !== 2} sx={{ height: '100%', overflowY: 'auto', p: 3 }}>
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Example Questions to Ask the AI
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Here are some example questions you can ask to get personalized college recommendations and advice:
              </Typography>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  College Fit & Recommendations
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What colleges would be a good fit for me based on my GPA and test scores?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Which colleges offer strong programs in my areas of interest?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Can you recommend some safety, match, and reach schools for me?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What colleges have good programs for [specific major] within my budget?"
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Financial Aid & Scholarships
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What are my chances of getting merit scholarships at these colleges?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Compare the financial aid packages at these schools."
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Which colleges offer the best value for my intended major?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What scholarships should I apply for based on my profile?"
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Application Strategy
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "How can I improve my chances of admission to [specific college]?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What should I focus on in my essays for these colleges?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Which extracurricular activities would strengthen my application?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What are the admission requirements for my target schools?"
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  Campus Life & Fit
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What's the campus culture like at [specific college]?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "Which colleges have strong alumni networks in my field?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "What are the research opportunities available to undergraduates?"
                  </Typography>
                  <Typography component="li" sx={{ mb: 1 }}>
                    "How do these colleges support students in my demographic?"
                  </Typography>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Tip:</strong> The more specific your questions, the better the AI can tailor its recommendations to your unique situation and goals.
                </Typography>
              </Alert>
            </Box>
          )}
        </Box>
      </Box>
    </StageContainer>
  );
};
