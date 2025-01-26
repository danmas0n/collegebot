import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Collapse,
  IconButton,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import SchoolIcon from '@mui/icons-material/School';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useChat } from '../../contexts/ChatContext';
import { useWizard } from '../../contexts/WizardContext';
import { useClaudeContext } from '../../contexts/ClaudeContext';
import { MapLocation } from '../../types/wizard';

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 39.8283, // Center of US
  lng: -98.5795,
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = [];

export const MapStage = (): JSX.Element => {
  const { currentStudent, data, updateData } = useWizard();
  const { apiKey } = useClaudeContext();
  const { chats, loadChats } = useChat();
  const [processingChats, setProcessingChats] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  interface StreamData {
    id: string;
    content: string;
    isOpen: boolean;
    isComplete: boolean;
  }
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);
  const [locationFormErrors, setLocationFormErrors] = useState<Record<string, string>>({});
  const [showDebugControls, setShowDebugControls] = useState(false);

  // Google Maps setup
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const processChats = useCallback(async (unprocessedChats: any[]) => {
    try {
      setProcessingChats(true);
      setTotalToProcess(unprocessedChats.length);
      setProcessedCount(0);
      setStreams([]);

      for (const chat of unprocessedChats) {
        let success = false;
        const timestamp = new Date().toLocaleTimeString();
        
        // Create new stream for this chat
        setStreams(prev => [...prev, {
          id: chat.id,
          content: `[${timestamp}] Processing chat: ${chat.id}\n`,
          isOpen: true,
          isComplete: false
        }]);
        
        try {
          if (!apiKey) {
            throw new Error('Claude API key not configured');
          }

          const response = await fetch('/api/chat/claude/analyze', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify({
              studentId: currentStudent?.id,
              chatId: chat.id,
              mode: 'map_enrichment'
            })
          });

          if (!response.ok) {
            throw new Error('Failed to process chat');
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(5));
                  const timestamp = new Date().toLocaleTimeString();
                  
                  await new Promise<void>(resolve => {
                    setStreams(prev => {
                      const newStreams = prev.map(stream => 
                        stream.id === chat.id 
                          ? { 
                              ...stream, 
                              content: stream.content + `\n[${timestamp}] ` + JSON.stringify(data, null, 2),
                              isComplete: data.type === 'complete'
                            }
                          : stream
                      );
                      resolve();
                      return newStreams;
                    });
                  });
                  
                  if (data.type === 'error') {
                    throw new Error(data.content);
                  } else if (data.type === 'complete') {
                    success = true;
                    
                    // Mark chat as processed
                    await fetch('/api/mcp/student-data/mark-chat-processed', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        studentId: currentStudent?.id,
                        chatId: chat.id,
                        lastMessageTimestamp: chat.updatedAt
                      })
                    });

                    // Update processed count, ensuring it doesn't exceed total
                    await new Promise<void>(resolve => {
                      setProcessedCount(prev => {
                        const newCount = Math.min(prev + 1, unprocessedChats.length);
                        resolve();
                        return newCount;
                      });
                    });

                    // Refresh map data after each chat is processed
                    const studentResponse = await fetch('/api/students');
                    const students = await studentResponse.json();
                    const updatedStudent = students.find((s: any) => s.id === currentStudent?.id);
                    if (updatedStudent) {
                      await new Promise<void>(resolve => {
                        updateData(updatedStudent.data);
                        resolve();
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error parsing SSE data:', error);
                }
              }
            }
          }
        } catch (error: any) {
          console.error('Error processing chat:', error);
          setError(`Failed to process chat: ${error?.message || 'Unknown error'}`);
        }

        if (!success) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setProcessingChats(false);
      return true;
    } catch (error) {
      console.error('Error in processChats:', error);
      setError(`Failed to process chats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [apiKey, currentStudent, updateData]);

  useEffect(() => {
    if (currentStudent) {
      loadChats(currentStudent.id).then(() => {
        setIsLoading(false);
      });
    }
  }, [currentStudent, loadChats]);

  // Add effect to auto-process chats on load
  useEffect(() => {
    const autoProcessChats = async () => {
      if (!currentStudent?.id || !apiKey) return;
      
      try {
        const unprocessedChats = chats.filter(chat => !chat.processed);
        if (unprocessedChats.length > 0) {
          setIsProcessing(true);
          setProcessingChats(true);
          console.log('Auto-processing unprocessed chats:', unprocessedChats.length);
          
          const success = await processChats(unprocessedChats);
          if (success) {
            await loadChats(currentStudent.id);
          }
        }
      } catch (err) {
        console.error('Failed to auto-process chats:', err);
        setError('Failed to auto-process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsProcessing(false);
        setProcessingChats(false);
        setIsLoading(false);
      }
    };

    if (currentStudent && !isLoading) {
      autoProcessChats();
    }
  }, [currentStudent, isLoading, chats, apiKey]);

  const handleDeleteLocation = async (location: MapLocation) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      
      // Get current locations
      const currentLocations = data.map?.locations || [];
      
      // Filter out the location to delete
      const updatedLocations = currentLocations.filter(loc => loc.id !== location.id);
      
      // Update the student data
      if (data.map) {
        updateData({
          ...data,
          map: {
            ...data.map,
            locations: updatedLocations
          }
        });
      }
      
      setIsDeleteDialogOpen(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Failed to delete location:', err);
      setError('Failed to delete location: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveLocation = async (formData: MapLocation) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      
      // Geocode the address if provided
      if (formData.metadata.address) {
        const response = await fetch('/api/mcp/student-data/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: formData.metadata.address,
            name: formData.name
          })
        });

        if (!response.ok) {
          throw new Error('Failed to geocode address');
        }

        const geocodeResult = await response.json();
        formData.latitude = geocodeResult.latitude;
        formData.longitude = geocodeResult.longitude;
      }

      // Create or update the location
      const response = await fetch('/api/mcp/student-data/create_map_location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentStudent.id,
          location: formData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save location');
      }

      // Refresh student data
      const studentResponse = await fetch('/api/students');
      const students = await studentResponse.json();
      const updatedStudent = students.find((s: any) => s.id === currentStudent.id);
      if (updatedStudent) {
        updateData(updatedStudent.data);
      }

      setIsEditDialogOpen(false);
      setEditingLocation(null);
    } catch (err) {
      console.error('Failed to save location:', err);
      setError('Failed to save location: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const validateLocationForm = (formData: Partial<MapLocation>): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.type) {
      errors.type = 'Type is required';
    }
    if (!formData.metadata?.address?.trim() && (!formData.latitude || !formData.longitude)) {
      errors.address = 'Either address or coordinates are required';
    }
    
    setLocationFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  if (loadError) {
    return <Alert severity="error">Error loading Google Maps</Alert>;
  }

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          College & Scholarship Map
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingLocation({
                id: `custom-${Date.now()}`,
                type: 'college',
                name: '',
                latitude: 0,
                longitude: 0,
                metadata: {}
              });
              setIsEditDialogOpen(true);
            }}
            disabled={!currentStudent || isLoading || isProcessing}
          >
            Add Location
          </Button>
          <IconButton
            onClick={() => setShowDebugControls(!showDebugControls)}
            size="small"
          >
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {processingChats && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Processing chats ({processedCount}/{totalToProcess})
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(processedCount / totalToProcess) * 100} 
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Debug Controls */}
      <Collapse in={showDebugControls}>
        <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
          <Typography variant="subtitle2" gutterBottom>Debug Controls</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined"
              size="small"
              onClick={async () => {
                if (!currentStudent?.id) return;
                
                try {
                  setIsLoading(true);
                  const response = await fetch('/api/chat/claude/mark-all-unprocessed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: currentStudent.id })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to mark chats as unprocessed');
                  }

                  await loadChats(currentStudent.id);
                } catch (err) {
                  console.error('Failed to mark chats as unprocessed:', err);
                  setError('Failed to mark chats as unprocessed');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={!currentStudent || isLoading || isProcessing}
            >
              Mark All Unprocessed
            </Button>
            <Button 
              variant="outlined"
              size="small"
              onClick={async () => {
                if (!currentStudent?.id) return;
                
                try {
                  setIsProcessing(true);
                  const unprocessedChats = chats.filter(chat => !chat.processed);
                  console.log('Found unprocessed chats:', unprocessedChats.length);
                  
                  if (unprocessedChats.length > 0) {
                    const success = await processChats(unprocessedChats);
                    if (success) {
                      await loadChats(currentStudent.id);
                    }
                  } else {
                    setError('No unprocessed chats found');
                  }
                } catch (err) {
                  console.error('Failed to process chats:', err);
                  setError('Failed to process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
                } finally {
                  setIsProcessing(false);
                  setProcessingChats(false);
                }
              }}
              disabled={!currentStudent || isLoading || isProcessing}
            >
              Process Chats
            </Button>
            <Button 
              variant="outlined"
              size="small"
              onClick={async () => {
                if (!currentStudent?.id) return;
                
                try {
                  setIsProcessing(true);
                  const response = await fetch('/api/mcp/student-data/clear-map-locations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: currentStudent.id })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to clear map locations');
                  }

                  // Refresh student data to update map
                  const studentResponse = await fetch('/api/students');
                  const students = await studentResponse.json();
                  const updatedStudent = students.find((s: any) => s.id === currentStudent.id);
                  if (updatedStudent) {
                    updateData(updatedStudent.data);
                  }
                } catch (err) {
                  console.error('Failed to clear map:', err);
                  setError('Failed to clear map: ' + (err instanceof Error ? err.message : 'Unknown error'));
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={!currentStudent || isLoading || isProcessing}
            >
              Clear Map
            </Button>
          </Box>

          {/* Stream Outputs */}
          {streams.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Processing Logs</Typography>
              {streams.map(stream => (
                <Paper key={stream.id} elevation={1} sx={{ mb: 2, backgroundColor: '#ffffff' }}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => setStreams(prev => prev.map(s => 
                      s.id === stream.id ? { ...s, isOpen: !s.isOpen } : s
                    ))}
                  >
                    <Typography variant="subtitle2">
                      Chat {stream.id} {stream.isComplete ? '(Complete)' : '(Processing...)'}
                    </Typography>
                    <IconButton size="small">
                      {stream.isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={stream.isOpen}>
                    <Box sx={{ px: 2, pb: 2, maxHeight: '300px', overflowY: 'auto' }}>
                      <Typography variant="caption" component="pre" sx={{ 
                        whiteSpace: 'pre-wrap', 
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        margin: 0
                      }}>
                        {stream.content}
                      </Typography>
                    </Box>
                  </Collapse>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Collapse>

      {!currentStudent ? (
        <Typography>Please select a student first.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {/* List View */}
          <Grid item xs={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Locations</Typography>
                  <Box>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        const sorted = [...(data.map?.locations || [])].sort((a, b) => a.name.localeCompare(b.name));
                        if (data.map) {
                          updateData({
                            ...data,
                            map: {
                              ...data.map,
                              locations: sorted
                            }
                          });
                        }
                      }}
                    >
                      <SortByAlphaIcon />
                    </IconButton>
                  </Box>
                </Box>
                <List>
                  {data.map?.locations.map((location) => (
                    <ListItem 
                      key={location.id}
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: selectedLocation?.id === location.id ? 'action.selected' : 'transparent',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        }
                      }}
                      onClick={() => setSelectedLocation(location)}
                    >
                      <ListItemIcon>
                        {location.type === 'college' ? (
                          <SchoolIcon color="primary" />
                        ) : (
                          <AttachMoneyIcon color="secondary" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={location.name}
                        secondary={
                          <Box component="div">
                            {location.type === 'college' && location.metadata.fitScore && (
                              <Box component="div" sx={{ display: 'block' }}>
                                Fit Score: {location.metadata.fitScore}
                              </Box>
                            )}
                            {location.type === 'scholarship' && location.metadata.amount && (
                              <Box component="div" sx={{ display: 'block' }}>
                                Amount: ${location.metadata.amount}
                              </Box>
                            )}
                            {location.metadata.website && (
                              <Link 
                                href={location.metadata.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Visit Website
                              </Link>
                            )}
                            {location.type === 'scholarship' && location.metadata.applicationUrl && (
                              <Box component="div" sx={{ display: 'block' }}>
                                <Link 
                                  href={location.metadata.applicationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Apply Now
                                </Link>
                              </Box>
                            )}
                            {(location.metadata.referenceLinks && location.metadata.referenceLinks.length > 0) && (
                              <Box component="div" sx={{ mt: 1 }}>
                                <Button
                                  size="small"
                                  endIcon={location.metadata.showLinks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!data.map?.locations) return;
                                    const updatedLocations = data.map.locations.map(loc => 
                                      loc.id === location.id 
                                        ? { 
                                            ...loc, 
                                            metadata: { 
                                              ...loc.metadata, 
                                              showLinks: !loc.metadata.showLinks 
                                            } 
                                          }
                                        : loc
                                    );
                                    updateData({
                                      ...data,
                                      map: {
                                        ...data.map,
                                        locations: updatedLocations
                                      }
                                    });
                                  }}
                                >
                                  {`${location.metadata.referenceLinks.length} Reference Links`}
                                </Button>
                                <Collapse in={!!location.metadata.showLinks}>
                                  <Box component="div" sx={{ mt: 1 }}>
                                    {Object.entries(
                                      (location.metadata.referenceLinks as NonNullable<typeof location.metadata.referenceLinks>).reduce<Record<string, NonNullable<typeof location.metadata.referenceLinks>>>((acc, link) => ({
                                        ...acc,
                                        [link.category]: [...(acc[link.category] || []), link]
                                      }), {})
                                    ).map(([category, links]) => (
                                      <Box key={category} sx={{ mb: 2 }}>
                                        <Typography component="div" variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                          {category.replace(/-/g, ' ')}
                                        </Typography>
                                        <Box component="div">
                                          <List dense>
                                            {(links as NonNullable<typeof location.metadata.referenceLinks>).map((link, index) => (
                                              <ListItem key={index} sx={{ py: 0 }}>
                                                <ListItemText
                                                  primary={
                                                    <Box component="div">
                                                      <Link
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        {link.title}
                                                      </Link>
                                                    </Box>
                                                  }
                                                  secondary={
                                                    <Box component="div" sx={{ fontSize: '0.75rem' }}>
                                                      {link.source} • {link.platform}
                                                      {link.notes && (
                                                        <Typography component="div" sx={{ mt: 0.5 }}>
                                                          {link.notes}
                                                        </Typography>
                                                      )}
                                                    </Box>
                                                  }
                                                />
                                              </ListItem>
                                            ))}
                                          </List>
                                        </Box>
                                      </Box>
                                    ))}
                                  </Box>
                                </Collapse>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLocation(location);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLocation(location);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Map View */}
          <Grid item xs={8}>
            <Card>
              <CardContent sx={{ p: 0 }}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  zoom={4}
                  center={defaultCenter}
                  options={{
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                >
                  {data.map?.locations.map((location) => (
                    <MarkerF
                      key={location.id}
                      position={{ lat: location.latitude, lng: location.longitude }}
                      onClick={() => setSelectedLocation(location)}
                      icon={{
                        url: location.type === 'college' 
                          ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                          : 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                      }}
                    />
                  ))}

                  {selectedLocation && (
                    <InfoWindowF
                      position={{ 
                        lat: selectedLocation.latitude, 
                        lng: selectedLocation.longitude 
                      }}
                      onCloseClick={() => setSelectedLocation(null)}
                    >
                      <Box sx={{ maxWidth: 300 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>{selectedLocation.name}</Typography>
                        {selectedLocation.metadata.website && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <Link 
                              href={selectedLocation.metadata.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              Visit Website
                            </Link>
                          </Typography>
                        )}
                        {selectedLocation.metadata.description && (
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {selectedLocation.metadata.description}
                          </Typography>
                        )}
                        {selectedLocation.type === 'college' && (
                          <Box sx={{ mb: 1 }}>
                            {selectedLocation.metadata.fitScore && (
                              <Typography variant="body2">
                                Fit Score: {selectedLocation.metadata.fitScore}
                              </Typography>
                            )}
                            {selectedLocation.metadata.reason && (
                              <Typography variant="body2">
                                Reason: {selectedLocation.metadata.reason}
                              </Typography>
                            )}
                            {/* CDS Academic Data */}
                            {selectedLocation.metadata.studentFacultyRatio && (
                              <Typography variant="body2">
                                Student-Faculty Ratio: {selectedLocation.metadata.studentFacultyRatio}
                              </Typography>
                            )}
                            {selectedLocation.metadata.graduationRate && (
                              <Typography variant="body2">
                                Graduation Rate: {selectedLocation.metadata.graduationRate.fourYear}% (4yr) / {selectedLocation.metadata.graduationRate.sixYear}% (6yr)
                              </Typography>
                            )}
                            {selectedLocation.metadata.retentionRate && (
                              <Typography variant="body2">
                                Retention Rate: {selectedLocation.metadata.retentionRate}%
                              </Typography>
                            )}
                            {/* CDS Admissions Data */}
                            {selectedLocation.metadata.acceptanceRate && (
                              <Typography variant="body2">
                                Acceptance Rate: {selectedLocation.metadata.acceptanceRate}%
                              </Typography>
                            )}
                            {selectedLocation.metadata.testScores?.sat && (
                              <Typography variant="body2">
                                SAT Range: {selectedLocation.metadata.testScores.sat.math[0]}-{selectedLocation.metadata.testScores.sat.math[1]} (Math) / {selectedLocation.metadata.testScores.sat.reading[0]}-{selectedLocation.metadata.testScores.sat.reading[1]} (Reading)
                              </Typography>
                            )}
                            {selectedLocation.metadata.testScores?.act && (
                              <Typography variant="body2">
                                ACT Range: {selectedLocation.metadata.testScores.act.composite[0]}-{selectedLocation.metadata.testScores.act.composite[1]}
                              </Typography>
                            )}
                            {/* CDS Financial Data */}
                            {selectedLocation.metadata.costOfAttendance && (
                              <Typography variant="body2">
                                Cost of Attendance: ${selectedLocation.metadata.costOfAttendance.total.toLocaleString()}
                              </Typography>
                            )}
                            {selectedLocation.metadata.financialAid && (
                              <Typography variant="body2">
                                Average Aid Package: ${selectedLocation.metadata.financialAid.averagePackage.toLocaleString()} ({selectedLocation.metadata.financialAid.percentReceivingAid}% receive aid)
                              </Typography>
                            )}
                          </Box>
                        )}
                        {selectedLocation.type === 'scholarship' && (
                          <Box sx={{ mb: 1 }}>
                            {selectedLocation.metadata.amount && (
                              <Typography variant="body2">
                                Amount: ${selectedLocation.metadata.amount.toLocaleString()}
                              </Typography>
                            )}
                            {selectedLocation.metadata.deadline && (
                              <Typography variant="body2">
                                Deadline: {selectedLocation.metadata.deadline}
                              </Typography>
                            )}
                            {selectedLocation.metadata.eligibility && (
                              <Typography variant="body2">
                                Eligibility: {selectedLocation.metadata.eligibility}
                              </Typography>
                            )}
                            {/* Historical Data */}
                            {selectedLocation.metadata.historicalData && (
                              <>
                                <Typography variant="body2">
                                  Annual Awards: {selectedLocation.metadata.historicalData.annualAwards}
                                </Typography>
                                {selectedLocation.metadata.historicalData.recipientStats?.averageGpa && (
                                  <Typography variant="body2">
                                    Average Recipient GPA: {selectedLocation.metadata.historicalData.recipientStats.averageGpa}
                                  </Typography>
                                )}
                              </>
                            )}
                            {/* Competition Data */}
                            {selectedLocation.metadata.competitionData && (
                              <Typography variant="body2">
                                Success Rate: {selectedLocation.metadata.competitionData.successRate}% ({selectedLocation.metadata.competitionData.annualApplicants} applicants)
                              </Typography>
                            )}
                            {selectedLocation.metadata.applicationUrl && (
                              <Typography variant="body2">
                                <Link 
                                  href={selectedLocation.metadata.applicationUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  Apply Now
                                </Link>
                              </Typography>
                            )}
                            {selectedLocation.metadata.sponsorWebsite && (
                              <Typography variant="body2">
                                <Link 
                                  href={selectedLocation.metadata.sponsorWebsite} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  Sponsor Website
                                </Link>
                              </Typography>
                            )}
                          </Box>
                        )}
                        {(selectedLocation.metadata.referenceLinks && selectedLocation.metadata.referenceLinks.length > 0) && (
                          <Box sx={{ mt: 2 }}>
                            <Button
                              size="small"
                              endIcon={selectedLocation.metadata.showLinks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!data.map?.locations) return;
                                const updatedLocations = data.map.locations.map(loc => 
                                  loc.id === selectedLocation.id 
                                    ? { 
                                        ...loc, 
                                        metadata: { 
                                          ...loc.metadata, 
                                          showLinks: !loc.metadata.showLinks 
                                        } 
                                      }
                                    : loc
                                );
                                updateData({
                                  ...data,
                                  map: {
                                    ...data.map,
                                    locations: updatedLocations
                                  }
                                });
                              }}
                            >
                              {`${selectedLocation.metadata.referenceLinks.length} Reference Links`}
                            </Button>
                            <Collapse in={!!selectedLocation.metadata.showLinks}>
                              <Box sx={{ mt: 1 }}>
                                {Object.entries(
                                  (selectedLocation.metadata.referenceLinks as NonNullable<typeof selectedLocation.metadata.referenceLinks>).reduce<Record<string, NonNullable<typeof selectedLocation.metadata.referenceLinks>>>((acc, link) => ({
                                    ...acc,
                                    [link.category]: [...(acc[link.category] || []), link]
                                  }), {})
                                ).map(([category, links]) => (
                                  <Box key={category} sx={{ mb: 2 }}>
                                    <Typography component="div" variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                                      {category.replace(/-/g, ' ')}
                                    </Typography>
                                    <Box component="div">
                                      <List dense>
                                        {(links as NonNullable<typeof selectedLocation.metadata.referenceLinks>).map((link, index) => (
                                          <ListItem key={index} sx={{ py: 0 }}>
                                            <ListItemText
                                              primary={
                                                <Box component="div">
                                                  <Link
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    {link.title}
                                                  </Link>
                                                </Box>
                                              }
                                              secondary={
                                                <Box component="div" sx={{ fontSize: '0.75rem' }}>
                                                  {link.source} • {link.platform}
                                                  {link.notes && (
                                                    <Typography component="div" sx={{ mt: 0.5 }}>
                                                      {link.notes}
                                                    </Typography>
                                                  )}
                                                </Box>
                                              }
                                            />
                                          </ListItem>
                                        ))}
                                      </List>
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            </Collapse>
                          </Box>
                        )}
                      </Box>
                    </InfoWindowF>
                  )}
                </GoogleMap>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog 
        open={isEditDialogOpen} 
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingLocation(null);
          setLocationFormErrors({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLocation?.id.startsWith('custom-') ? 'Add Location' : 'Edit Location'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              fullWidth
              value={editingLocation?.name || ''}
              onChange={(e) => setEditingLocation(prev => prev ? { ...prev, name: e.target.value } : null)}
              error={!!locationFormErrors.name}
              helperText={locationFormErrors.name}
            />
            <FormControl fullWidth error={!!locationFormErrors.type}>
              <InputLabel>Type</InputLabel>
              <Select
                value={editingLocation?.type || ''}
                label="Type"
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, type: e.target.value as 'college' | 'scholarship' } : null)}
              >
                <MenuItem value="college">College</MenuItem>
                <MenuItem value="scholarship">Scholarship</MenuItem>
              </Select>
              {locationFormErrors.type && (
                <FormHelperText>{locationFormErrors.type}</FormHelperText>
              )}
            </FormControl>
            <TextField
              label="Address"
              fullWidth
              value={editingLocation?.metadata.address || ''}
              onChange={(e) => setEditingLocation(prev => prev ? {
                ...prev,
                metadata: { ...prev.metadata, address: e.target.value }
              } : null)}
              error={!!locationFormErrors.address}
              helperText={locationFormErrors.address || 'Enter address for automatic geocoding'}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Latitude"
                type="number"
                value={editingLocation?.latitude || ''}
                onChange={(e) => setEditingLocation(prev => prev ? {
                  ...prev,
                  latitude: parseFloat(e.target.value)
                } : null)}
                disabled={!!editingLocation?.metadata.address}
              />
              <TextField
                label="Longitude"
                type="number"
                value={editingLocation?.longitude || ''}
                onChange={(e) => setEditingLocation(prev => prev ? {
                  ...prev,
                  longitude: parseFloat(e.target.value)
                } : null)}
                disabled={!!editingLocation?.metadata.address}
              />
            </Box>
            <TextField
              label="Website"
              fullWidth
              value={editingLocation?.metadata.website || ''}
              onChange={(e) => setEditingLocation(prev => prev ? {
                ...prev,
                metadata: { ...prev.metadata, website: e.target.value }
              } : null)}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={editingLocation?.metadata.description || ''}
              onChange={(e) => setEditingLocation(prev => prev ? {
                ...prev,
                metadata: { ...prev.metadata, description: e.target.value }
              } : null)}
            />
            {editingLocation?.type === 'college' && (
              <>
                <TextField
                  label="Fit Score"
                  type="number"
                  inputProps={{ min: 0, max: 100 }}
                  value={editingLocation.metadata.fitScore || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, fitScore: parseInt(e.target.value) }
                  } : null)}
                />
                <TextField
                  label="Fit Reason"
                  fullWidth
                  multiline
                  rows={2}
                  value={editingLocation.metadata.reason || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, reason: e.target.value }
                  } : null)}
                />
              </>
            )}
            {editingLocation?.type === 'scholarship' && (
              <>
                <TextField
                  label="Amount"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={editingLocation.metadata.amount || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, amount: parseInt(e.target.value) }
                  } : null)}
                />
                <TextField
                  label="Deadline"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={editingLocation.metadata.deadline || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, deadline: e.target.value }
                  } : null)}
                />
                <TextField
                  label="Eligibility"
                  fullWidth
                  multiline
                  rows={2}
                  value={editingLocation.metadata.eligibility || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, eligibility: e.target.value }
                  } : null)}
                />
                <TextField
                  label="Application URL"
                  fullWidth
                  value={editingLocation.metadata.applicationUrl || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, applicationUrl: e.target.value }
                  } : null)}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIsEditDialogOpen(false);
            setEditingLocation(null);
            setLocationFormErrors({});
          }}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (editingLocation && validateLocationForm(editingLocation)) {
                handleSaveLocation(editingLocation);
              }
            }}
            variant="contained"
            disabled={isProcessing}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setEditingLocation(null);
        }}
      >
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {editingLocation?.name}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIsDeleteDialogOpen(false);
            setEditingLocation(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={() => editingLocation && handleDeleteLocation(editingLocation)}
            color="error"
            variant="contained"
            disabled={isProcessing}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
