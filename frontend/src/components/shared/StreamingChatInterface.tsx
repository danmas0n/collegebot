import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useWizard } from '../../contexts/WizardContext';
import { AiChatMessage } from '../../types/college';
import { CollapsibleMessage } from '../CollapsibleMessage';
import { api } from '../../utils/api';
import { WizardStage } from '../../types/wizard';
import { trackAIChatMessage } from '../../utils/analytics';

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

export interface StreamingChatInterfaceRef {
  handleSendMessage: (message: string, skipAddMessage?: boolean) => Promise<void>;
}

export const StreamingChatInterface = forwardRef<StreamingChatInterfaceRef, StreamingChatInterfaceProps>(({
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
}, ref) => {
  const { currentStudent, startLLMOperation, endLLMOperation } = useWizard();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [currentProcessingChat, setCurrentProcessingChat] = useState<string>('');
  const [processingComplete, setProcessingComplete] = useState(false);
  
  // Timer state
  const [operationStartTime, setOperationStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
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

  // Expose handleSendMessage through ref
  useImperativeHandle(ref, () => ({
    handleSendMessage
  }));

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

  // Ref to track if we should skip auto-save (e.g., when streaming is handling the save)
  const skipAutoSave = useRef(false);

  // Ref to track the latest messages for use in complete handler
  const latestMessagesRef = useRef<Message[]>([]);

  // Sync ref with messages state
  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  // Save chat when messages change (chat mode only)
  useEffect(() => {
    if (mode === 'chat' && currentChat && messages.length > 0 && !isLoading && !isJustSwitchingChats.current && !skipAutoSave.current) {
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

  // Timer effect - update elapsed time every second when loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading && operationStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - operationStartTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else if (!isLoading) {
      setOperationStartTime(null);
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading, operationStartTime]);

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
      setOperationStartTime(new Date());
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

  const handleSendMessage = async (messageContent?: string, skipAddMessage: boolean = false) => {
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
    setOperationStartTime(new Date());
    setError(null);

    try {
      let updatedMessages = messages;

      // Only add the user message if it's not already in the messages (skipAddMessage = false)
      if (!skipAddMessage) {
        const userMessage: Message = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        };

        updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
      }

      setCurrentMessage('');

      // Track user message
      trackAIChatMessage('user', operationType, currentStudent?.id);

      // Build history - always include current message for API call
      // When skipAddMessage=true, the message wasn't added to updatedMessages (for UI),
      // but we still need to include it in the history sent to the backend
      const historyForAPI = skipAddMessage
        ? [...updatedMessages, { role: 'user', content: message, timestamp: new Date().toISOString() }]
        : updatedMessages;

      // Send to backend
      const response = await api.post('/api/chat/message', {
        message: message,
        studentData: wizardData ? { ...wizardData, id: currentStudent?.id } : { ...currentStudent },
        studentName: currentStudent.name || 'Student',
        history: historyForAPI.slice(-10).map(msg => ({
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
    }, 1800000); // 30 minute timeout

    try {
      while (true && !streamComplete) {
        const { done, value } = await reader.read();
        if (done) {
          // Stream ended - check if we received a complete event
          if (!streamComplete) {
            console.warn('Stream ended without complete event - likely Cloud Run timeout');

            // Add a system message to inform the user
            const timeoutMessage: Message = {
              role: 'thinking',
              content: '⚠️ **Connection interrupted** - The request took too long and was terminated by the server. Your conversation has been saved up to this point. You can continue by sending another message.',
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, timeoutMessage]);

            // Save the chat with whatever messages we have
            if (mode === 'chat' && currentChat) {
              const partialChat = {
                ...currentChat,
                messages: latestMessagesRef.current,
                updatedAt: new Date().toISOString()
              };
              console.log('Saving partial chat after timeout with', latestMessagesRef.current.length, 'messages');
              onChatUpdate?.(partialChat);
              saveChatToBackend(partialChat).catch(err => console.error('Failed to save partial chat:', err));
            }

            // Clean up UI state
            setIsLoading(false);
            if (currentOperationId) {
              endLLMOperation(currentOperationId);
              setOperationId(null);
            }
          }
          break;
        }

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
                
                // Track AI response
                trackAIChatMessage('assistant', operationType, currentStudent?.id);
                break;

              case 'title':
                // Handle suggested title for chat mode
                if (mode === 'chat' && data.suggestedTitle && currentChat) {
                  console.log('Setting suggested title:', data.suggestedTitle);
                  suggestedTitle = data.suggestedTitle;

                  // Don't save yet - wait for complete event to do a single atomic save
                  // Just update the title variable so it's available when complete fires
                }
                break;

              case 'complete':
                console.log('Received complete event');

                setIsLoading(false);
                setProcessingComplete(true);

                // Handle suggested title for chat mode (fallback if not handled in title event)
                if (mode === 'chat' && currentChat) {
                  console.log('Complete event - saving chat with final state');

                  // Get the current title (use suggested if available)
                  const finalTitle = data.suggestedTitle || suggestedTitle || currentChat.title;

                  // Set skipAutoSave briefly to prevent auto-save effect from running during our save
                  skipAutoSave.current = true;

                  // IMPORTANT: Use setTimeout to allow React state updates to flush before reading the ref.
                  // The 'response' event that arrives just before 'complete' triggers setMessages(),
                  // but the useEffect that syncs latestMessagesRef.current may not have run yet.
                  // This delay ensures the ref has the complete message history including the final answer.
                  setTimeout(() => {
                    // Use the ref to get the latest messages (includes all streamed messages)
                    const updatedChat = {
                      ...currentChat,
                      title: finalTitle,
                      messages: latestMessagesRef.current,
                      updatedAt: new Date().toISOString()
                    };

                    console.log('Saving chat with', latestMessagesRef.current.length, 'messages');

                    // Single save operation
                    onChatUpdate?.(updatedChat);
                    saveChatToBackend(updatedChat).then(() => {
                      // Reset skipAutoSave after save completes
                      skipAutoSave.current = false;
                    }).catch((error) => {
                      console.error('Failed to save chat:', error);
                      // Reset even on error
                      skipAutoSave.current = false;
                    });
                  }, 50);  // 50ms is enough for React to flush state updates
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

              case 'chat_saved':
                // Handle chat saved notification from strategic planning
                const chatSavedMessage: Message = {
                  role: 'thinking',
                  content: data.content || `Strategic planning session saved as chat: "${data.chatTitle}"`,
                  timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, chatSavedMessage]);
                console.log('Strategic planning chat saved:', { chatId: data.chatId, title: data.chatTitle });
                break;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);

      // Add error message to chat
      const errorMessage: Message = {
        role: 'thinking',
        content: `⚠️ **Connection error** - ${error instanceof Error ? error.message : 'Unknown error'}. Your conversation has been saved. You can continue by sending another message.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);

      // Save the chat with whatever messages we have
      if (mode === 'chat' && currentChat) {
        const partialChat = {
          ...currentChat,
          messages: latestMessagesRef.current,
          updatedAt: new Date().toISOString()
        };
        console.log('Saving partial chat after error with', latestMessagesRef.current.length, 'messages');
        onChatUpdate?.(partialChat);
        saveChatToBackend(partialChat).catch(err => console.error('Failed to save partial chat:', err));
      }

      // Clean up UI state
      setIsLoading(false);
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

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Timer Display - Upper Right (Sticky) */}
      {isLoading && operationStartTime && (
        <Box sx={{
          position: 'fixed',
          top: 80, // Below the AppBar
          right: 16,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          px: 2,
          py: 1,
          borderRadius: 2,
          boxShadow: 2,
          border: 1,
          borderColor: 'divider'
        }}>
          <AccessTimeIcon fontSize="small" color="primary" />
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600, minWidth: '45px' }}>
            {formatElapsedTime(elapsedTime)}
          </Typography>
        </Box>
      )}

      {/* Header */}
      {(title || description) && (
        <Box sx={{ mb: 3, pr: isLoading ? 10 : 0 }}>
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
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          gap: 2, 
          overflow: 'hidden',
          maxWidth: '100%',
          minWidth: 0
        }}>
          {/* Chat List */}
          <Box sx={{ 
            width: { xs: '100%', md: '300px' }, 
            maxWidth: { xs: '100%', md: '300px' },
            flexShrink: 0, 
            height: '100%', 
            display: { xs: 'none', md: 'flex' }, 
            flexDirection: 'column',
            minWidth: 0
          }}>
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
          <Box sx={{ 
            flex: 1, 
            minWidth: 0, 
            maxWidth: '100%',
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
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

            {/* Add padding at bottom to prevent content from being hidden behind floating input */}
            <Box sx={{ height: '120px' }} />
          </Box>
        </Box>
      )}

      {/* Processing Mode Layout */}
      {mode === 'processing' && (
        <Paper sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          maxHeight: '100%'
        }}>
          <Box sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            p: 2, 
            minHeight: 0,
            maxHeight: '100%',
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '4px'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px'
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555'
            }
          }}>
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
});
