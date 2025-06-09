import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  AutoAwesome as AIIcon,
  School as SchoolIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useWizard } from '../../contexts/WizardContext';
import { Plan, PlanItem } from '../../types/plan';
import { api } from '../../utils/api';
import { getAuth } from 'firebase/auth';

interface AIPlanBuilderProps {
  plan: Plan;
  onPlanUpdated: (updatedPlan: Plan) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  planItems?: PlanItem[];
}

interface ProposedPlan {
  items: PlanItem[];
  reasoning: string;
}

export const AIPlanBuilder: React.FC<AIPlanBuilderProps> = ({ 
  plan, 
  onPlanUpdated, 
  onClose 
}) => {
  const { currentStudent, data } = useWizard();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<ProposedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize conversation with a welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm here to help you create a comprehensive application plan for ${plan.schoolName}. 

I'll analyze your student profile, the school's requirements, and current application timelines to create a personalized plan with specific tasks and deadlines.

To get started, tell me:
- What specific aspects of the application process are you most concerned about?
- Are there any particular deadlines you're aware of?
- Do you have any preferences for when you'd like to complete certain tasks?`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, [plan.schoolName]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Add initial AI message that will be updated with streaming content
    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, initialAssistantMessage]);

    try {
      // Prepare context for the AI
      const context = {
        student: currentStudent,
        studentProfile: data.studentProfile,
        collegeInterests: data.collegeInterests,
        budgetInfo: data.budgetInfo,
        plan: plan,
        schoolData: data.map?.locations?.find(loc => loc.id === plan.schoolId),
        conversationHistory: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      };

      const response = await fetch('/api/plans/build-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuth().currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          planId: plan.id,
          message: messageContent,
          context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';
      let proposedItems: PlanItem[] = [];
      let reasoning = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'response') {
                  accumulatedContent += data.content;
                  // Update the assistant message with accumulated content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                } else if (data.type === 'thinking') {
                  // Could show thinking indicator
                  console.log('AI thinking:', data.content);
                } else if (data.type === 'complete') {
                  // Stream complete
                  break;
                } else if (data.type === 'error') {
                  throw new Error(data.content);
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // For now, we'll need to parse any proposed tasks from the response content
      // This is a simplified approach - in a full implementation, the AI would use tools
      // to create structured task proposals
      
      // Update final message
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: accumulatedContent, planItems: proposedItems }
          : msg
      ));

      // If we detected proposed items, set them for review
      if (proposedItems.length > 0) {
        setProposedPlan({
          items: proposedItems,
          reasoning: reasoning || 'AI-generated plan based on your requirements.'
        });
      }

    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get AI response. Please try again.');
      // Remove the failed assistant message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAcceptPlan = async () => {
    if (!proposedPlan) return;

    try {
      setIsLoading(true);
      
      // Update the plan with the proposed items
      const updatedPlan: Plan = {
        ...plan,
        timeline: proposedPlan.items,
        status: 'active',
        updatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        sourceChats: [...plan.sourceChats, messages[messages.length - 1]?.id || '']
      };

      const response = await api.put(`/api/plans/${plan.id}`, updatedPlan);
      
      if (response.ok) {
        onPlanUpdated(updatedPlan);
        setProposedPlan(null);
        
        // Add confirmation message
        const confirmMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: 'Perfect! I\'ve added all the tasks to your plan. You can now view them in the Plan Details tab, and they\'ll also appear in your calendar. Feel free to ask me to modify any tasks or add additional ones!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, confirmMessage]);
      }
    } catch (err) {
      console.error('Error accepting plan:', err);
      setError('Failed to save plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectPlan = () => {
    setProposedPlan(null);
    
    const rejectMessage: ChatMessage = {
      id: (Date.now() + 3).toString(),
      role: 'assistant',
      content: 'No problem! Let me know what you\'d like to change about the plan, and I\'ll create a revised version for you.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, rejectMessage]);
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AIIcon color="primary" />
            <Typography variant="h6">
              AI Plan Builder - {plan.schoolName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Chat Messages */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2
          }}
        >
          {messages.map((message) => (
            <Box key={message.id} sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                {message.role === 'assistant' ? (
                  <AIIcon color="primary" fontSize="small" />
                ) : (
                  <Box 
                    sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  >
                    U
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                  {message.role === 'assistant' ? 'AI Assistant' : 'You'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {message.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
              
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  ml: message.role === 'user' ? 4 : 0,
                  mr: message.role === 'assistant' ? 4 : 0,
                  bgcolor: message.role === 'user' ? 'primary.50' : 'background.paper'
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                
                {message.planItems && message.planItems.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Proposed Tasks:
                    </Typography>
                    {message.planItems.map((item, index) => (
                      <Chip
                        key={index}
                        label={`${item.title} (${new Date(item.dueDate).toLocaleDateString()})`}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>
          ))}
          
          {isLoading && (
            <Box display="flex" alignItems="center" gap={1} sx={{ mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                AI is thinking...
              </Typography>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>

        {/* Proposed Plan Review */}
        {proposedPlan && (
          <Card sx={{ mb: 2, border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                📋 Proposed Plan Review
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {proposedPlan.reasoning}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                Tasks ({proposedPlan.items.length}):
              </Typography>
              
              {proposedPlan.items.map((item, index) => (
                <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Due: {new Date(item.dueDate).toLocaleDateString()} • Priority: {item.priority}
                  </Typography>
                </Box>
              ))}
              
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleAcceptPlan}
                  disabled={isLoading}
                >
                  Accept Plan
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleRejectPlan}
                  disabled={isLoading}
                >
                  Request Changes
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Input Area */}
        <Box display="flex" gap={1}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            placeholder="Ask me to create or modify your application plan..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            <SendIcon />
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
