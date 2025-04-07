import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  LinearProgress, 
  Button, 
  Divider, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon,
  Collapse,
  Alert,
  CircularProgress,
  Chip,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SchoolIcon from '@mui/icons-material/School';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { api } from '../../utils/api';
import { MapLocation } from '../../types/wizard';

interface ResearchStatusPanelProps {
  activeResearchId: string | null;
  locations: MapLocation[];
}

interface ResearchRequest {
  id: string;
  studentId: string;
  pinIds: string[];
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  progress: number;
  findings: Array<{
    pinId: string;
    deadlines?: Array<{
      date: string;
      description: string;
      source?: string;
    }>;
    requirements?: Array<{
      description: string;
      source?: string;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

const ResearchStatusPanel: React.FC<ResearchStatusPanelProps> = ({ activeResearchId, locations }) => {
  const [research, setResearch] = useState<ResearchRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(true);
  const [expandedPins, setExpandedPins] = useState<Record<string, boolean>>({});
  
  // Load research data
  useEffect(() => {
    const loadResearch = async () => {
      if (!activeResearchId) {
        setResearch(null);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await api.get(`/api/pin-research/request/${activeResearchId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to load research: ${response.status}`);
        }
        
        const data = await response.json();
        setResearch(data);
        
        // Initialize expanded state for all pins
        const expanded: Record<string, boolean> = {};
        data.pinIds.forEach((pinId: string) => {
          expanded[pinId] = true;
        });
        setExpandedPins(expanded);
      } catch (err) {
        console.error('Error loading research:', err);
        setError('Failed to load research: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadResearch();
    
    // Poll for updates if research is in progress
    let interval: number | undefined;
    
    if (activeResearchId) {
      interval = window.setInterval(loadResearch, 2000);
    }
    
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [activeResearchId]);
  
  // Handle creating tasks from research
  const handleCreateTasks = async () => {
    if (!activeResearchId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post(`/api/tasks/from-research/${activeResearchId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create tasks: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Created tasks:', data);
      
      // Show success message
      setError('Tasks created successfully!');
    } catch (err) {
      console.error('Error creating tasks:', err);
      setError('Failed to create tasks: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle creating calendar items from research
  const handleCreateCalendarItems = async () => {
    if (!activeResearchId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post(`/api/calendar/from-research/${activeResearchId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create calendar items: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Created calendar items:', data);
      
      // Show success message
      setError('Calendar items created successfully!');
    } catch (err) {
      console.error('Error creating calendar items:', err);
      setError('Failed to create calendar items: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle expanded state for a pin
  const togglePinExpanded = (pinId: string) => {
    setExpandedPins(prev => ({
      ...prev,
      [pinId]: !prev[pinId]
    }));
  };
  
  // Get location name from pinId
  const getLocationName = (pinId: string): string => {
    const location = locations.find(loc => loc.id === pinId);
    return location ? location.name : 'Unknown Location';
  };
  
  // If no active research, show a message
  if (!activeResearchId) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Research Status
        </Typography>
        <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
          No active research. Use the selector below to start researching pins.
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">
          Research Status
        </Typography>
        <IconButton
          onClick={() => setShowDetails(!showDetails)}
          size="small"
        >
          {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      
      {error && (
        <Alert 
          severity={error.includes('successfully') ? 'success' : 'error'} 
          onClose={() => setError(null)} 
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      
      {isLoading && !research ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress />
        </Box>
      ) : research ? (
        <>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2">
                Status: <Chip 
                  label={research.status.charAt(0).toUpperCase() + research.status.slice(1)} 
                  color={
                    research.status === 'complete' ? 'success' : 
                    research.status === 'error' ? 'error' : 
                    research.status === 'in-progress' ? 'primary' : 
                    'default'
                  }
                  size="small"
                />
              </Typography>
              <Typography variant="body2">
                Progress: {research.progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={research.progress} 
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              Started: {new Date(research.createdAt).toLocaleString()}
            </Typography>
          </Box>
          
          <Collapse in={showDetails}>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Findings
            </Typography>
            
            {research.findings.length === 0 ? (
              <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
                No findings yet. Research is in progress...
              </Typography>
            ) : (
              <List>
                {research.pinIds.map(pinId => {
                  const finding = research.findings.find(f => f.pinId === pinId);
                  const locationName = getLocationName(pinId);
                  
                  return (
                    <React.Fragment key={pinId}>
                      <ListItem 
                        button 
                        onClick={() => togglePinExpanded(pinId)}
                        sx={{ bgcolor: 'background.default', mb: 1 }}
                      >
                        <ListItemIcon>
                          <SchoolIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={locationName}
                          secondary={finding ? 
                            `${finding.deadlines?.length || 0} deadlines, ${finding.requirements?.length || 0} requirements` : 
                            'No findings yet'
                          }
                        />
                        {expandedPins[pinId] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </ListItem>
                      
                      <Collapse in={expandedPins[pinId]}>
                        {finding ? (
                          <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                            {/* Deadlines */}
                            {finding.deadlines && finding.deadlines.length > 0 && (
                              <>
                                <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                                  Deadlines
                                </Typography>
                                <List dense>
                                  {finding.deadlines.map((deadline, idx) => (
                                    <ListItem key={idx}>
                                      <ListItemIcon>
                                        <EventIcon color="secondary" />
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={deadline.description}
                                        secondary={
                                          <>
                                            <Typography variant="body2" component="span">
                                              Due: {deadline.date}
                                            </Typography>
                                            {deadline.source && (
                                              <Typography variant="caption" component="div" color="text.secondary">
                                                Source: {deadline.source}
                                              </Typography>
                                            )}
                                          </>
                                        }
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </>
                            )}
                            
                            {/* Requirements */}
                            {finding.requirements && finding.requirements.length > 0 && (
                              <>
                                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                                  Requirements
                                </Typography>
                                <List dense>
                                  {finding.requirements.map((requirement, idx) => (
                                    <ListItem key={idx}>
                                      <ListItemIcon>
                                        <AssignmentIcon color="info" />
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={requirement.description}
                                        secondary={requirement.source && (
                                          <Typography variant="caption" component="div" color="text.secondary">
                                            Source: {requirement.source}
                                          </Typography>
                                        )}
                                      />
                                    </ListItem>
                                  ))}
                                </List>
                              </>
                            )}
                          </Box>
                        ) : (
                          <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              No findings available for this location yet.
                            </Typography>
                          </Box>
                        )}
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </List>
            )}
            
            {research.status === 'complete' && research.findings.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleCreateCalendarItems}
                  disabled={isLoading}
                >
                  Add to Calendar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreateTasks}
                  disabled={isLoading}
                >
                  Create Tasks
                </Button>
              </Box>
            )}
          </Collapse>
        </>
      ) : (
        <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
          Research not found or has been deleted.
        </Typography>
      )}
    </Paper>
  );
};

export default ResearchStatusPanel;
