import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  IconButton,
  Collapse,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useWizard } from '../../contexts/WizardContext';
import { AiChatMessage } from '../../types/college';
import { CollapsibleMessage } from '../CollapsibleMessage';
import { api } from '../../utils/api';
import { WizardStage } from '../../types/wizard';

interface Message extends AiChatMessage {
  timestamp: string;
  toolData?: string;
}

interface StreamingChatInterfaceProps {
  // Chat mode props
  mode: 'chat' | 'processing';
  
  // Chat mode specific
  chats?: any[];
  currentChat?: any;
  onChatChange?: (chat: any) => void;
  onNewChat?: () => any;
  onDeleteChat?: (chatId: string) => void;
  onChatUpdate?: (updatedChat: any) => void;
  showInput?: boolean;
  wizardData?: any; // Full wizard data for student context
  viewMode?: 'full' | 'collapsed'; // New prop for view mode
  
  // Processing mode specific
  autoStart?: boolean;
  processingEndpoint?: string;
  processingPayload?: any;
  onProcessingComplete?: () => void;
  onProcessingError?: (error: string) => void;
  
  // Common props
  title?: string;
  description?: string;
  operationType?: WizardStage;
  operationDescription?: string;
  llmOperationType?: 'research' | 'map-processing' | 'chat' | 'recommendations';
}

export const StreamingChatInterface: React.FC<StreamingChatInterfaceProps> = ({
  mode,
  chats = [],
  currentChat,
  onChatChange,
  onNewChat,
  onDeleteChat,
  onChatUpdate,
  showInput = true,
  wizardData,
  viewMode = 'full',
  autoStart = false,
  processingEndpoint,
  processingPayload,
  onProcessingComplete,
  onProcessingError,
  title,
  description,
  operationType = 'recommendations',
  operationDescription = 'Chat conversation',
  llmOperationType = 'chat'
}) => {
  const { currentStudent, startLLMOperation, endLLMOperation } = useWizard();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [currentProcessingChat, setCurrentProcessingChat] = useState<string>('');
  const [processingComplete, setProcessingComplete] = useState(false);
  
  // Auto-detect if we should use collapsed view based on message content
  const shouldUseCollapsedView = () => {
    return messages.some(msg => msg.role === 'answer');
  };

  const [currentViewMode, setCurrentViewMode] = useState<'full' | 'collapsed'>(viewMode);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Set initial view mode based on prop
  useEffect(() => {
    setCurrentViewMode(viewMode);
  }, [viewMode]);

  // Update view mode when messages change - auto-switch to collapsed when answer arrives
  useEffect(() => {
    if (shouldUseCollapsedView() && currentViewMode === 'full' && !isLoading) {
      setCurrentViewMode('collapsed');
    }
  }, [messages, currentViewMode, isLoading]);

  // Reset to full view when starting a new message
  useEffect(() => {
    if (isLoading && currentViewMode === 'collapsed') {
      // Only reset if we're starting a new conversation (no answers yet)
      const hasAnswers = messages.some(msg => msg.role === 'answer');
      if (!hasAnswers) {
        setCurrentViewMode('full');
      }
    }
  }, [isLoading, currentViewMode, messages]);
  
  // Ref to prevent duplicate processing
  const hasStartedProcessing = useRef(false);
  
  // Ref to prevent infinite chat update loops
  const isUpdatingFromParent = useRef(false);

  // Auto-start processing mode
  useEffect(() => {
    if (mode === 'processing' && autoStart && currentStudent?.id && !isLoading && processingEndpoint && !hasStartedProcessing.current) {
      hasStartedProcessing.current = true;
      handleProcessing();
    }
  }, [mode, autoStart, currentStudent?.id, processingEndpoint]);

  // Ref to track if we're just switching chats vs actually updating messages
  const isJustSwitchingChats = useRef(false);

  // Update messages when currentChat changes (chat mode)
  useEffect(() => {
    if (mode === 'chat' && currentChat) {
      isJustSwitchingChats.current = true;
      setMessages(currentChat.messages || []);
      // Reset the flag after a brief delay to allow the save effect to see it
      setTimeout(() => {
        isJustSwitchingChats.current = false;
      }, 0);
    }
  }, [mode, currentChat]);

  // Save chat when messages change (chat mode only)
  useEffect(() => {
    if (mode === 'chat' && currentChat && messages.length > 0 && !isLoading && !isJustSwitchingChats.current) {
      // Check if messages have actually changed to prevent infinite loops
      const currentMessages = currentChat.messages || [];
      const messagesChanged = JSON.stringify(currentMessages) !== JSON.stringify(messages);
      
      if (messagesChanged) {
        const updatedChat = {
          ...currentChat,
          messages: messages,
          updatedAt: new Date().toISOString()
        };
        
        // Update parent component state
        onChatUpdate?.(updatedChat);
        
        // Save to backend
        saveChatToBackend(updatedChat);
      }
    }
  }, [messages, currentChat, mode, isLoading]);

  // Cleanup operation on unmount
  useEffect(() => {
    return () => {
      if (operationId) {
        console.log('StreamingChatInterface unmounting, ending LLM operation:', operationId);
        endLLMOperation(operationId);
      }
    };
  }, [operationId, endLLMOperation]);

  const saveChatToBackend = async (chat: any) => {
    if (!currentStudent?.id) return;
    
    try {
      await api.post('/api/chat/save-frontend-chat', {
        studentId: currentStudent.id,
        chat: chat
      });
      console.log('Chat saved successfully');
    } catch (error) {
      console.error('Error saving chat:', error);
      // Don't show error to user for background saves
    }
  };

  const handleProcessing = async () => {
    if (!currentStudent?.id || !processingEndpoint) return;
    
    // Start LLM operation tracking
    const opId = startLLMOperation({
      stage: operationType,
      type: llmOperationType || 'map-processing',
      description: operationDescription
    });
    setOperationId(opId);
    
    // Store the operation ID locally
    const currentOperationId = opId;
    
    try {
      setIsLoading(true);
      setError(null);
      setMessages([]);
      setProcessingComplete(false);
      
      const response = await api.post(processingEndpoint, {
        studentId: currentStudent.id,
        ...processingPayload
      }, { stream: true });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader');
      
      await handleStreamingResponse(reader, currentOperationId);
      
    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = 'Processing failed: ' + (err instanceof Error ? err.message : 'Unknown error');
      setError(errorMessage);
      onProcessingError?.(errorMessage);
      
      // End operation on error
      if (currentOperationId) {
        console.log('Ending LLM operation due to error:', currentOperationId);
        endLLMOperation(currentOperationId);
        setOperationId(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageContent?: string) => {
    if (!currentStudent?.id || mode !== 'chat') return;
    
    const message = messageContent || currentMessage;
    if (!message.trim()) return;

    // Start LLM operation tracking
    const opId = startLLMOperation({
      stage: 'recommendations',
      type: 'chat',
      description: `Chat conversation: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
    });
    setOperationId(opId);
    
    const currentOperationId = opId;

    setIsLoading(true);
    setError(null);

    try {
      // Add user message immediately
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setCurrentMessage('');

      // Send to backend
      const response = await api.post('/api/chat/message', {
        message: message,
        studentData: wizardData ? { ...wizardData, id: currentStudent?.id } : { ...currentStudent },
        studentName: currentStudent.name || 'Student',
        history: updatedMessages.slice(-10).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        chatId: currentChat?.id,
        studentId: currentStudent.id,
        title: currentChat?.title
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body received');

      await handleStreamingResponse(reader, currentOperationId);

    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      
      // End operation on error
      if (currentOperationId) {
        console.log('Ending LLM operation due to chat error:', currentOperationId);
        endLLMOperation(currentOperationId);
        setOperationId(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamingResponse = async (reader: ReadableStreamDefaultReader<Uint8Array>, currentOperationId: string) => {
    const decoder = new TextDecoder();
    let streamComplete = false;
    let currentThinkingMessage = '';
    let hasToolCalls = false;
    let messageContent = '';
    let suggestedTitle = '';

    // Set a timeout for the entire streaming operation
    const streamTimeoutId = setTimeout(() => {
      console.log('Stream timeout reached, aborting reader');
      reader.cancel('Timeout reached');
      
      if (currentOperationId) {
        console.log('Ending LLM operation due to timeout');
        endLLMOperation(currentOperationId);
        setOperationId(null);
      }
    }, 300000); // 5 minute timeout

    try {
      while (true && !streamComplete) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.slice(5);
            if (!jsonStr.trim()) continue;
            const data = JSON.parse(jsonStr);

            switch (data.type) {
              case 'thinking':
                if (data.toolData) {
                  hasToolCalls = true;
                  // Tool-related message - combine content and toolData
                  const thinkingMessage: Message = {
                    role: 'thinking',
                    content: data.content + (data.toolData ? `\n\nTool Data:\n${data.toolData}` : ''),
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [...prev, thinkingMessage]);
                  currentThinkingMessage = '';
                } else {
                  // Regular thinking update
                  if (currentThinkingMessage) {
                    setMessages(prev => prev.map((msg, i) => 
                      i === prev.length - 1 && msg.role === 'thinking'
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    ));
                  } else {
                    const thinkingMessage: Message = {
                      role: 'thinking',
                      content: data.content,
                      timestamp: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, thinkingMessage]);
                    currentThinkingMessage = data.content;
                  }
                }
                break;

              case 'content_block_delta':
                if (data.delta.type === 'text_delta') {
                  messageContent += data.delta.text;
                  
                  const thinkingMessage: Message = {
                    role: 'thinking',
                    content: messageContent,
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [
                    ...prev.filter(msg => msg.role !== 'thinking'),
                    thinkingMessage
                  ]);
                }
                break;

              case 'message_stop':
                if (!hasToolCalls && messageContent.trim()) {
                  const questionMessage: Message = {
                    role: 'question',
                    content: messageContent,
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [
                    ...prev.filter(msg => msg.role !== 'thinking'),
                    questionMessage
                  ]);
                }
                break;

              case 'response':
                const answerMessage: Message = {
                  role: 'answer',
                  content: data.content,
                  timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, answerMessage]);
                break;

              case 'title':
                // Handle suggested title for chat mode
                if (mode === 'chat' && data.suggestedTitle && currentChat) {
                  console.log('Setting suggested title:', data.suggestedTitle);
                  suggestedTitle = data.suggestedTitle;
                  
                  // Update the current chat with the new title
                  setMessages(prev => {
                    const updatedChat = {
                      ...currentChat,
                      title: suggestedTitle,
                      messages: prev,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Update parent and save
                    onChatUpdate?.(updatedChat);
                    saveChatToBackend(updatedChat);
                    
                    return prev; // Don't change messages
                  });
                }
                break;

              case 'complete':
                console.log('Received complete event');
                setIsLoading(false);
                setProcessingComplete(true);
                
                // Handle suggested title for chat mode (fallback if not handled in title event)
                if (mode === 'chat' && data.suggestedTitle && currentChat && !suggestedTitle) {
                  console.log('Setting suggested title from complete event:', data.suggestedTitle);
                  suggestedTitle = data.suggestedTitle;
                  
                  // Update the current chat with the new title
                  setMessages(prev => {
                    const updatedChat = {
                      ...currentChat,
                      title: suggestedTitle,
                      messages: prev,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Update parent and save
                    onChatUpdate?.(updatedChat);
                    saveChatToBackend(updatedChat);
                    
                    return prev; // Don't change messages
                  });
                }
                
                // End the LLM operation immediately when processing completes
                if (currentOperationId) {
                  console.log('Processing complete, ending LLM operation:', currentOperationId);
                  endLLMOperation(currentOperationId);
                  setOperationId(null);
                }
                
                // For processing mode, notify completion
                if (mode === 'processing') {
                  console.log('Processing mode complete, notifying parent');
                  // Call onProcessingComplete to notify MapDebugControls
                  onProcessingComplete?.();
                }
                
                streamComplete = true;
                clearTimeout(streamTimeoutId);
                break;

              case 'error':
                setError(data.content);
                break;

              case 'status':
                // Handle status updates for processing mode
                if (data.chatTitle) {
                  setCurrentProcessingChat(data.chatTitle);
                  // Add a message showing which chat is being processed
                  const processingMessage: Message = {
                    role: 'user',
                    content: `Processing: ${data.chatTitle}`,
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [...prev, processingMessage]);
                }
                break;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);
      // End operation on stream error
      if (currentOperationId) {
        console.log('Ending LLM operation due to stream error:', currentOperationId);
        endLLMOperation(currentOperationId);
        setOperationId(null);
      }
    } finally {
      reader.releaseLock();
      clearTimeout(streamTimeoutId);
      console.log('Stream reading completed, reader released');
    }
  };

  // Group messages for collapsed view
  const groupMessages = (messages: Message[]) => {
    const groups: Array<{
      question: Message;
      thinking: Message[];
      answer?: Message;
    }> = [];
    
    let currentGroup: {
      question: Message;
      thinking: Message[];
      answer?: Message;
    } | null = null;
    
    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          question: message,
          thinking: [],
          answer: undefined
        };
      } else if (message.role === 'thinking' && currentGroup) {
        currentGroup.thinking.push(message);
      } else if (message.role === 'answer' && currentGroup) {
        currentGroup.answer = message;
      }
    }
    
    // Add the last group if it exists
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const toggleThinkingSection = (groupIndex: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(groupIndex)) {
      newExpanded.delete(groupIndex);
    } else {
      newExpanded.add(groupIndex);
    }
    setExpandedSections(newExpanded);
  };

  const renderCollapsedView = () => {
    const messageGroups = groupMessages(messages);
    
    return (
      <List sx={{ width: '100%', flex: 1 }}>
        {messageGroups.map((group, groupIndex) => (
          <Box key={groupIndex} sx={{ mb: 3 }}>
            {/* User Question */}
            <ListItem sx={{ px: 0, alignItems: 'flex-start', mb: 1 }}>
              <CollapsibleMessage 
                message={group.question}
                isLatest={false}
              />
            </ListItem>
            
            {/* Thinking Section (Collapsible) */}
            {group.thinking.length > 0 && (
              <Box sx={{ ml: 2, mb: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={expandedSections.has(groupIndex) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => toggleThinkingSection(groupIndex)}
                  sx={{ mb: 1 }}
                >
                  Thinking ({group.thinking.length} steps)
                </Button>
                
                <Collapse in={expandedSections.has(groupIndex)}>
                  <Box sx={{ ml: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                    {group.thinking.map((thinkingMsg, thinkingIndex) => (
                      <ListItem key={thinkingIndex} sx={{ px: 0, alignItems: 'flex-start', py: 1 }}>
                        <CollapsibleMessage 
                          message={thinkingMsg}
                          isLatest={false}
                        />
                      </ListItem>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}
            
            {/* Answer */}
            {group.answer && (
              <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                <CollapsibleMessage 
                  message={group.answer}
                  isLatest={groupIndex === messageGroups.length - 1 && isLoading}
                />
              </ListItem>
            )}
          </Box>
        ))}
      </List>
    );
  };

  const renderMessage = (msg: Message, index: number) => {
    return (
      <CollapsibleMessage 
        key={index}
        message={msg}
        isLatest={index === messages.length - 1 && isLoading}
      />
    );
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {(title || description) && (
        <Box sx={{ mb: 3 }}>
          {title && (
            <Typography variant="h5" gutterBottom>
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Chat Mode Layout */}
      {mode === 'chat' && (
        <Box sx={{ height: '100%', display: 'flex', gap: 2 }}>
          {/* Chat List */}
          <Box sx={{ width: 300, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, height: '100%', overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Chats</Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={onNewChat}
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
                    onClick={() => onChatChange?.(chat)}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat?.(chat.id);
                        }}
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
            </Box>
          </Box>

          {/* Chat Messages */}
          <Box sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Chat Title */}
            {currentChat && messages.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">{currentChat.title || 'Chat'}</Typography>
              </Box>
            )}
            
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 2 }}>
              {currentViewMode === 'collapsed' ? (
                renderCollapsedView()
              ) : (
                <List sx={{ width: '100%', flex: 1 }}>
                  {messages.map((msg, index) => (
                    <ListItem key={index} sx={{ px: 0, alignItems: 'flex-start' }}>
                      {renderMessage(msg, index)}
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            {showInput && (
              <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
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
            )}
          </Box>
        </Box>
      )}

      {/* Processing Mode Layout */}
      {mode === 'processing' && (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, minHeight: 0 }}>
            {currentViewMode === 'collapsed' && shouldUseCollapsedView() ? (
              renderCollapsedView()
            ) : (
              <List sx={{ width: '100%' }}>
                {messages.map((msg, index) => (
                  <ListItem key={index} sx={{ px: 0, alignItems: 'flex-start' }}>
                    {renderMessage(msg, index)}
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
};
