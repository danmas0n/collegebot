import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  School as SchoolIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Drafts as DraftIcon,
  PlayArrow as ActiveIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { useWizard } from '../../contexts/WizardContext';
import { useChat } from '../../contexts/ChatContext';
import { Plan, PlanCreationRequest } from '../../types/plan';
import { MapLocation } from '../../types/wizard';
import { api } from '../../utils/api';

interface PlanOverviewProps {
  onPlanSelect: (plan: Plan) => void;
}

export const PlanOverview: React.FC<PlanOverviewProps> = ({ onPlanSelect }) => {
  const { currentStudent, data } = useWizard();
  const { setCurrentChat, loadChats } = useChat();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<string>('general');
  const [planDescription, setPlanDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Get available schools from map locations
  const availableSchools = data.map?.locations || [];

  useEffect(() => {
    if (currentStudent?.id) {
      loadPlans();
    }
  }, [currentStudent?.id]);

  const loadPlans = async () => {
    if (!currentStudent?.id) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/plans/${currentStudent.id}`);
      const data = await response.json();
      setPlans(data);
    } catch (err) {
      console.error('Error loading plans:', err);
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!currentStudent?.id) return;

    try {
      const selectedLocation = availableSchools.find(loc => loc.id === selectedSchool);
      const schoolName = selectedLocation?.name || 'General';

      const planData: PlanCreationRequest = {
        studentId: currentStudent.id,
        schoolId: selectedSchool,
        schoolName,
        description: planDescription
      };

      const response = await api.post('/api/plans', planData);
      const newPlan = await response.json();

      setPlans(prev => [newPlan, ...prev]);
      setCreateDialogOpen(false);
      setSelectedSchool('general');
      setPlanDescription('');
      
      // Automatically select the new plan
      onPlanSelect(newPlan);
    } catch (err) {
      console.error('Error creating plan:', err);
      setError('Failed to create plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await api.delete(`/api/plans/${planId}`);
      setPlans(prev => prev.filter(p => p.id !== planId));
      setMenuAnchor(null);
      setSelectedPlan(null);
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError('Failed to delete plan');
    }
  };

  const handleViewSourceChat = async (plan: Plan) => {
    if (!plan.sourceChats || plan.sourceChats.length === 0 || !currentStudent?.id) {
      setError('No source chat available for this plan');
      return;
    }

    try {
      // Load chats to find the source chat
      await loadChats(currentStudent.id);
      
      // Get the first source chat ID
      const sourceChatId = plan.sourceChats[0];
      
      // Find the chat in the loaded chats
      const chats = await api.get('/api/chat/chats', {
        method: 'POST',
        body: JSON.stringify({ studentId: currentStudent.id })
      });
      const chatData = await chats.json();
      const sourceChat = chatData.chats.find((chat: any) => chat.id === sourceChatId);
      
      if (sourceChat) {
        // Set the current chat and navigate to recommendations
        setCurrentChat(sourceChat);
        
        // Navigate to recommendations stage
        // Since we don't have access to setCurrentStage, we'll show a message
        setError(null);
        alert(`Source chat "${sourceChat.title}" has been loaded. Please navigate to the Recommendations stage to view it.`);
      } else {
        setError('Source chat not found');
      }
    } catch (err) {
      console.error('Error loading source chat:', err);
      setError('Failed to load source chat');
    }
    
    setMenuAnchor(null);
    setSelectedPlan(null);
  };

  const getStatusIcon = (status: Plan['status']) => {
    switch (status) {
      case 'draft':
        return <DraftIcon color="action" />;
      case 'active':
        return <ActiveIcon color="primary" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      default:
        return <DraftIcon color="action" />;
    }
  };

  const getStatusColor = (status: Plan['status']) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'active':
        return 'primary';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Application Plans
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={!currentStudent}
        >
          Create Plan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {plans.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <SchoolIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Plans Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Create your first application plan to get started with organizing your college application process.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {plans.map((plan) => (
            <Grid item xs={12} sm={6} md={4} key={plan.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { elevation: 4 }
                }}
                onClick={() => onPlanSelect(plan)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {plan.schoolId === 'general' ? (
                        <CalendarIcon color="primary" />
                      ) : (
                        <SchoolIcon color="primary" />
                      )}
                      <Typography variant="h6" component="div">
                        {plan.schoolName}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAnchor(e.currentTarget);
                        setSelectedPlan(plan);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    {getStatusIcon(plan.status)}
                    <Chip 
                      label={plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      size="small"
                      color={getStatusColor(plan.status) as any}
                    />
                  </Box>

                  {plan.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {plan.description}
                    </Typography>
                  )}

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {plan.timeline.length} tasks • Updated {new Date(plan.updatedAt).toLocaleDateString()}
                    </Typography>
                    {plan.sourceChats && plan.sourceChats.length > 0 && (
                      <Chip
                        icon={<ChatIcon />}
                        label="Has Source Chat"
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Plan</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>School</InputLabel>
              <Select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                label="School"
              >
                <MenuItem value="general">General (School-Independent)</MenuItem>
                {availableSchools.map((school) => (
                  <MenuItem key={school.id} value={school.id}>
                    {school.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              margin="normal"
              label="Description (Optional)"
              multiline
              rows={3}
              value={planDescription}
              onChange={(e) => setPlanDescription(e.target.value)}
              placeholder="Describe what this plan will help you accomplish..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} variant="contained">
            Create Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Plan Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => selectedPlan && onPlanSelect(selectedPlan)}>
          View Plan
        </MenuItem>
        {selectedPlan && selectedPlan.sourceChats && selectedPlan.sourceChats.length > 0 && (
          <MenuItem 
            onClick={() => selectedPlan && handleViewSourceChat(selectedPlan)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <ChatIcon fontSize="small" />
            View Source Chat
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => selectedPlan && handleDeletePlan(selectedPlan.id)}
          sx={{ color: 'error.main' }}
        >
          Delete Plan
        </MenuItem>
      </Menu>
    </Box>
  );
};
