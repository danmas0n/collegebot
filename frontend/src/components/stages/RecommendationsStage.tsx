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
  TextField,
  CircularProgress,
  Paper,
  FormControl,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChatIcon from '@mui/icons-material/Chat';
import MapIcon from '@mui/icons-material/Map';
import PlanIcon from '@mui/icons-material/Assignment';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useWizard } from '../../contexts/WizardContext';
import { useChat } from '../../contexts/ChatContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useSidebar } from '../../App';
import { StageContainer, StageHeader } from './StageContainer';
import TipsAdvicePanel from '../calendar/TipsAdvicePanel';
import { StreamingChatInterface, StreamingChatInterfaceRef } from '../shared/StreamingChatInterface';
import { api } from '../../utils/api';

import { AiChat } from '../../types/college';

interface Chat extends AiChat {
  toolData?: string;
  type?: string;
}

export const RecommendationsStage: React.FC = () => {
  const { currentStudent, data } = useWizard();
  const { chats, currentChat, loadChats, setCurrentChat } = useChat();
  const { isCollapsed } = useSidebar();
  const [error, setError] = useState<string | null>(null);
  const hasLoadedChats = useRef(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [strategicPlanChats, setStrategicPlanChats] = useState<Chat[]>([]);
  const [regularChats, setRegularChats] = useState<Chat[]>([]);
  
  // Chat filtering state
  const [chatFilter, setChatFilter] = useState<string>('recommendations');
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);

  // Load chats when component mounts or student changes
  useEffect(() => {
    if (currentStudent?.id && !hasLoadedChats.current) {
      hasLoadedChats.current = true;
      loadChats(currentStudent.id).then(loadedChats => {
        // Filter chats by type
        const strategic = loadedChats.filter(chat => (chat as any).type === 'strategic-planning');
        const regular = loadedChats.filter(chat => !(chat as any).type || (chat as any).type !== 'strategic-planning');
        
        setStrategicPlanChats(strategic);
        setRegularChats(regular);
        
        // Only set a default chat if no chat is currently selected (not coming from deep link)
        if (!currentChat && loadedChats.length > 0) {
          // Select the most recent chat
          const mostRecentChat = loadedChats[loadedChats.length - 1];
          setCurrentChat(mostRecentChat);
        }
      });
    }
  }, [currentStudent?.id]); // Only depend on currentStudent.id

  // Filter chats based on selected filter
  useEffect(() => {
    const filterChats = () => {
      switch (chatFilter) {
        case 'recommendations':
          // Show chats with no type or type 'recommendations'
          return chats.filter(chat => !(chat as any).type || (chat as any).type === 'recommendations');
        case 'strategic-planning':
          return chats.filter(chat => (chat as any).type === 'strategic-planning');
        case 'map-processing':
          return chats.filter(chat => (chat as any).type === 'map-processing');
        case 'all':
          return chats;
        default:
          return chats.filter(chat => !(chat as any).type || (chat as any).type === 'recommendations');
      }
    };

    setFilteredChats(filterChats());
  }, [chats, chatFilter]);

  // Helper function to get chat type display info
  const getChatTypeInfo = (chat: Chat) => {
    const type = (chat as any).type;
    switch (type) {
      case 'strategic-planning':
        return { icon: <PlanIcon />, label: 'Strategic Plan', color: 'primary' };
      case 'map-processing':
        return { icon: <MapIcon />, label: 'Map Analysis', color: 'secondary' };
      default:
        return { icon: <ChatIcon />, label: 'Recommendation', color: 'default' };
    }
  };

  // Helper function to get chat count by type
  const getChatCounts = () => {
    const recommendations = chats.filter(chat => !(chat as any).type || (chat as any).type === 'recommendations').length;
    const strategic = chats.filter(chat => (chat as any).type === 'strategic-planning').length;
    const mapProcessing = chats.filter(chat => (chat as any).type === 'map-processing').length;
    
    return { recommendations, strategic, mapProcessing, total: chats.length };
  };

  // Reset the hasLoadedChats flag when student changes
  useEffect(() => {
    hasLoadedChats.current = false;
  }, [currentStudent?.id]);

  const createNewChat = async (): Promise<Chat | null> => {
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
    
    try {
      // Immediately save the chat to the backend so it has a valid ID
      await api.post('/api/chat/save-frontend-chat', {
        studentId: currentStudent.id,
        chat: newChat
      });
      
      console.log('New chat saved to backend:', newChat.id);
      
      // Reload chats to show the new chat in the sidebar
      await loadChats(currentStudent.id);
      
      setCurrentChat(newChat);
      return newChat;
    } catch (error) {
      console.error('Error saving new chat:', error);
      setError('Failed to create new chat');
      return null;
    }
  };

  const handleChatChange = (chat: Chat) => {
    setCurrentChat(chat);
  };

  const handleNewChat = async () => {
    const newChat = await createNewChat();
    return newChat;
  };

  const handleChatUpdate = useCallback(async (updatedChat: Chat) => {
    // The ChatContext will handle updating the chats array
    setCurrentChat(updatedChat);
    
    // Always reload chats to ensure the list is updated with title changes
    // This ensures that title updates from streaming responses are reflected in the sidebar
    if (currentStudent?.id) {
      console.log('Chat updated, reloading chats list to reflect changes');
      
      // Add a small delay to ensure backend save completes before reloading
      setTimeout(async () => {
        await loadChats(currentStudent.id);
      }, 500); // 500ms delay to allow backend save to complete
    }
  }, [setCurrentChat, loadChats, currentStudent?.id]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!currentStudent?.id) return;
    
    try {
      // Use the api utility which handles authentication headers
      // Note: We need to use a custom approach since api.delete doesn't support body
      const response = await api.get(`/api/chat/chats/${chatId}`, {
        method: 'DELETE',
        body: JSON.stringify({ studentId: currentStudent.id })
      });

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
  
  // Floating chat input state
  const [floatingMessage, setFloatingMessage] = useState('');
  const [isFloatingLoading, setIsFloatingLoading] = useState(false);
  const streamingChatRef = useRef<StreamingChatInterfaceRef>(null);
  
  // Auto-collapse examples after 5 seconds
  useEffect(() => {
    if (showExamples) {
      const timer = setTimeout(() => {
        setShowExamples(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showExamples]);

  // Handle floating chat input
  const handleFloatingSendMessage = async () => {
    if (!floatingMessage.trim() || isFloatingLoading) return;
    
    // Create a new chat if none exists
    let chatToUse = currentChat;
    if (!chatToUse) {
      chatToUse = await createNewChat();
      if (!chatToUse) return;
    }
    
    // Switch to chat tab if not already there
    if (activeTab !== 0) {
      setActiveTab(0);
    }
    
    // Use the StreamingChatInterface's send message functionality
    // We'll trigger this by calling the interface directly
    setIsFloatingLoading(true);
    
    try {
      // Call the StreamingChatInterface's handleSendMessage through a ref
      if (streamingChatRef.current && streamingChatRef.current.handleSendMessage) {
        await streamingChatRef.current.handleSendMessage(floatingMessage);
      }
      setFloatingMessage('');
    } catch (error) {
      console.error('Error sending floating message:', error);
      setError('Failed to send message');
    } finally {
      setIsFloatingLoading(false);
    }
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <StageContainer data-testid="recommendations-stage" sx={{ position: 'relative' }}>
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
      <Box sx={{ 
        flex: 1, 
        minHeight: 0, 
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden', 
        position: 'relative' 
      }}>
        {/* Chat Tab */}
        <Box role="tabpanel" hidden={activeTab !== 0} sx={{ 
          height: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative'
        }}>
          {activeTab === 0 && (
            <>
              <Box sx={{ 
                // Add padding to match floating input positioning
                pl: 0, // No left padding since the chat list provides the spacing
                pr: 2, // Right padding to match floating input
                pb: 10 // Bottom padding to prevent content from being hidden behind floating input
              }}>
                {/* Chat Filter Controls */}
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, px: 2 }}>
                  <FilterListIcon color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Filter chats:
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={chatFilter}
                      onChange={(e) => setChatFilter(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="recommendations">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ChatIcon fontSize="small" />
                          Recommendations ({getChatCounts().recommendations})
                        </Box>
                      </MenuItem>
                      <MenuItem value="strategic-planning">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlanIcon fontSize="small" />
                          Strategic Planning ({getChatCounts().strategic})
                        </Box>
                      </MenuItem>
                      <MenuItem value="map-processing">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MapIcon fontSize="small" />
                          Map Processing ({getChatCounts().mapProcessing})
                        </Box>
                      </MenuItem>
                      <MenuItem value="all">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          All Chats ({getChatCounts().total})
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  
                  {/* Show current filter as chip */}
                  {chatFilter !== 'recommendations' && (
                    <Chip
                      size="small"
                      label={`Showing: ${chatFilter === 'all' ? 'All Chats' : 
                        chatFilter === 'strategic-planning' ? 'Strategic Planning' :
                        chatFilter === 'map-processing' ? 'Map Processing' : 'Recommendations'}`}
                      onDelete={() => setChatFilter('recommendations')}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>

                <StreamingChatInterface
                  ref={streamingChatRef}
                  mode="chat"
                  chats={filteredChats}
                  currentChat={currentChat}
                  onChatChange={handleChatChange}
                  onNewChat={handleNewChat}
                  onDeleteChat={handleDeleteChat}
                  onChatUpdate={handleChatUpdate}
                  showInput={false}
                  wizardData={data}
                  operationType="recommendations"
                  llmOperationType="chat"
                  operationDescription="Chat conversation"
                />
              </Box>
              
              {/* Floating Chat Input - Pinned to bottom of viewport, above chat interface */}
              <Paper sx={{
                position: 'fixed',
                bottom: 20,
                left: isCollapsed ? 'calc(64px + 320px)' : 'calc(280px + 320px)', // Responsive sidebar width + chat list width
                right: 20,
                p: 2,
                zIndex: 1000,
                boxShadow: 3,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                transition: 'left 0.3s ease' // Smooth transition when sidebar collapses/expands
              }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    placeholder="Ask a question about college recommendations..."
                    value={floatingMessage}
                    onChange={(e) => setFloatingMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleFloatingSendMessage();
                      }
                    }}
                    disabled={isFloatingLoading}
                    size="small"
                    multiline
                    maxRows={3}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleFloatingSendMessage}
                    disabled={!floatingMessage.trim() || isFloatingLoading}
                    sx={{ 
                      minWidth: '80px',
                      height: '40px',
                      borderRadius: 2
                    }}
                  >
                    {isFloatingLoading ? <CircularProgress size={20} /> : 'Send'}
                  </Button>
                </Box>
              </Paper>
            </>
          )}
        </Box>

        {/* Tips & Advice Tab */}
        <Box role="tabpanel" hidden={activeTab !== 1} sx={{ 
          height: '100%', 
          maxWidth: '100%',
          minWidth: 0,
          overflowY: 'auto' 
        }}>
          {activeTab === 1 && (
            <TipsAdvicePanel />
          )}
        </Box>

        {/* Example Questions Tab */}
        <Box role="tabpanel" hidden={activeTab !== 2} sx={{ 
          height: '100%', 
          maxWidth: '100%',
          minWidth: 0,
          overflowY: 'auto', 
          p: 3 
        }}>
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
