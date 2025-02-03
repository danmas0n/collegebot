import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';
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
  const { currentStudent } = useWizard();
  const { chats, loadChats } = useChat();
  // State definitions
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);
  const [locationFormErrors, setLocationFormErrors] = useState<Record<string, string>>({});
  const [showDebugControls, setShowDebugControls] = useState<boolean>(false);

  // Google Maps setup
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // State for processing status
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingTotal, setProcessingTotal] = useState<number>(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [showProcessingLogs, setShowProcessingLogs] = useState<boolean>(true);

  // Load map locations
  const { currentStage } = useWizard();
  useEffect(() => {
    const loadLocations = async () => {
      if (!currentStudent?.id || currentStage !== 'map') {
        setLocations([]);
        return;
      }

      try {
        setIsLoading(true);
        const response = await api.post('/api/students/map-locations/get', {
          studentId: currentStudent.id
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to load locations: ${response.status}`);
        }
        const data = await response.json();
        setLocations(data);
      } catch (err) {
        console.error('Error loading locations:', err);
        setError('Failed to load locations: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
  }, [currentStudent?.id, currentStage]);

  // Process chats after map is loaded
  useEffect(() => {
    const processChats = async () => {
      if (!currentStudent?.id || currentStage !== 'map' || isLoading) {
        setIsProcessing(false); // Ensure processing is false when conditions aren't met
        return;
      }

      // Wait a bit to ensure map is rendered and interactive
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Only set processing if we actually have unprocessed chats
        const hasUnprocessedChats = chats?.some(chat => !chat.processed);
        if (!hasUnprocessedChats) {
          setIsProcessing(false);
          return;
        }

        setIsProcessing(true);
        
        // Process any unprocessed chats
        const processStream = await api.post(`/api/chat/process-all`, {
          studentId: currentStudent.id
        }, { stream: true });

        if (!processStream.ok) {
          throw new Error('Failed to process chats');
        }

        const reader = processStream.body?.getReader();
        if (!reader) {
          throw new Error('No stream reader available');
        }

        // Reset processing state
        setProcessingLogs([]);
        setProcessingProgress(0);
        setProcessingTotal(0);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Parse SSE data
          const text = new TextDecoder().decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'status') {
                setProcessingStatus(data.content);
                if (data.total) setProcessingTotal(data.total);
                if (data.progress) setProcessingProgress(data.progress);
              } else if (data.type === 'thinking') {
                setProcessingLogs(prev => [...prev, data.content]);
              } else if (data.type === 'error') {
                setError(data.content);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }

        // Reload locations after processing
        const response = await api.post('/api/students/map-locations/get', {
          studentId: currentStudent.id
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to load locations: ${response.status}`);
        }
        const data = await response.json();
        setLocations(data);
      } catch (err) {
        console.error('Error processing chats:', err);
        setError('Failed to process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsProcessing(false);
      }
    };

    processChats();
  }, [currentStudent?.id, currentStage, isLoading]);

  const handleDeleteLocation = async (location: MapLocation) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      
      // Delete the location
      const response = await api.post('/api/students/map-locations/delete', {
        studentId: currentStudent.id,
        locationId: location.id
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete location: ${response.status}`);
      }

      // Update local state
      setLocations(prev => prev.filter(loc => loc.id !== location.id));
      setIsDeleteDialogOpen(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Failed to delete location:', err);
      setError('Failed to delete location: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveLocation = async (formData: Partial<MapLocation>) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      
      // Geocode the address if provided
      if (formData.metadata?.address) {
        const response = await api.post('/api/student-data/geocode', {
          address: formData.metadata.address,
          name: formData.name
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to geocode address');
        }

        const geocodeResult = await response.json();
        formData.latitude = geocodeResult.latitude;
        formData.longitude = geocodeResult.longitude;
      }

      // Create or update the location
      const response = await api.post('/api/students/map-locations', {
        ...formData,
        studentId: currentStudent.id
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to save location');
      }

      // Update local state with the response
      const updatedLocations = await response.json();
      setLocations(updatedLocations);

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
              } as MapLocation);
              setIsEditDialogOpen(true);
            }}
            disabled={!currentStudent || isProcessing}
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

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Collapse in={showDebugControls || !!processingStatus}>
        <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
          {processingStatus && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">{processingStatus}</Typography>
                <Button
                  size="small"
                  onClick={() => setShowProcessingLogs(!showProcessingLogs)}
                  endIcon={showProcessingLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                >
                  {showProcessingLogs ? 'Hide' : 'Show'} Details
                </Button>
              </Box>
              {processingTotal > 0 && (
                <LinearProgress 
                  variant="determinate" 
                  value={(processingProgress / processingTotal) * 100} 
                  sx={{ mb: 1 }}
                />
              )}
              <Collapse in={showProcessingLogs}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    mt: 1, 
                    p: 1, 
                    maxHeight: '200px', 
                    overflow: 'auto',
                    bgcolor: 'grey.100'
                  }}
                >
                  {processingLogs.map((log, index) => {
                    // Handle both string and object logs
                    const logContent = typeof log === 'string' ? log : (log as { content: string }).content;
                    return (
                      <React.Fragment key={index}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            mb: 0.5
                          }}
                        >
                          {logContent}
                        </Typography>
                        {index < processingLogs.length - 1 && (
                          <Box 
                            sx={{ 
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              my: 1
                            }} 
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </Paper>
              </Collapse>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined"
                size="small"
                onClick={async () => {
                  if (!currentStudent?.id) return;
                  
                  try {
                    setIsProcessing(true);
                    const response = await api.post(`/api/students/${currentStudent.id}/clear-map-locations`);

                    if (!response.ok) {
                      throw new Error('Failed to clear map locations');
                    }

                    // Clear local state
                    setLocations([]);
                  } catch (err) {
                    console.error('Failed to clear map:', err);
                    setError('Failed to clear map: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={!currentStudent || isProcessing}
              >
                Clear Map
              </Button>

              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  if (!currentStudent?.id || !chats) return;
                  
                  try {
                    setIsProcessing(true);
                    const response = await api.post(`/api/chat/mark-unprocessed`, {
                      studentId: currentStudent.id,
                      chatIds: chats.map(chat => chat.id)
                    });

                    if (!response.ok) {
                      throw new Error('Failed to mark chats as unprocessed');
                    }

                    // Reload chats to update UI
                    await loadChats(currentStudent.id);
                  } catch (err) {
                    console.error('Failed to mark chats as unprocessed:', err);
                    setError('Failed to mark chats as unprocessed: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={!currentStudent || isProcessing}
              >
                Mark Chats Unprocessed
              </Button>

              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  if (!currentStudent?.id || !chats) return;
                  
                  try {
                    setIsProcessing(true);
                    const response = await api.post(`/api/chat/process-all`, {
                      studentId: currentStudent.id,
                      chatIds: chats.map(chat => chat.id)
                    });

                    if (!response.ok) {
                      throw new Error('Failed to process chats');
                    }

                    // Reload chats and locations
                    await loadChats(currentStudent.id);
                    const locationsResponse = await api.post('/api/students/map-locations/get', {
                      studentId: currentStudent.id
                    });
                    if (locationsResponse.ok) {
                      const data = await locationsResponse.json();
                      setLocations(data);
                    }
                  } catch (err) {
                    console.error('Failed to process chats:', err);
                    setError('Failed to process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={!currentStudent || isProcessing}
              >
                Process All Chats
              </Button>
            </Box>
          </Box>
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
            <Card sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ 
                flex: 1, 
                p: 2, 
                '&:last-child': { pb: 2 },
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Locations</Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));
                      setLocations(sorted);
                    }}
                  >
                    <SortByAlphaIcon />
                  </IconButton>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <List>
                    {locations.map((location) => (
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
                              {location.metadata.referenceLinks && location.metadata.referenceLinks.length > 0 && (
                                <Box component="div">
                                  <Button
                                    size="small"
                                    endIcon={location.metadata.showLinks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      setLocations(prev => prev.map(loc => 
                                        loc.id === location.id 
                                          ? { 
                                              ...loc, 
                                              metadata: { 
                                                ...loc.metadata, 
                                                showLinks: !loc.metadata.showLinks 
                                              } 
                                            }
                                          : loc
                                      ));
                                    }}
                                  >
                                    {`${location.metadata.referenceLinks.length} Reference Links`}
                                  </Button>
                                  <Collapse in={location.metadata.showLinks}>
                                    <List dense>
                                      {location.metadata.referenceLinks.map((link, index) => (
                                        <ListItem key={index}>
                                          <Link 
                                            href={link.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                          >
                                            {link.title || `Reference ${index + 1}`}
                                          </Link>
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Collapse>
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
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
                  {locations.map((location) => (
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
                          </Box>
                        )}
                        {selectedLocation.type === 'scholarship' && (
                          <Box sx={{ mb: 1 }}>
                            {selectedLocation.metadata.amount && (
                              <Typography variant="body2">
                                Amount: ${selectedLocation.metadata.amount}
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
                          </Box>
                        )}
                        {(selectedLocation.metadata.referenceLinks && selectedLocation.metadata.referenceLinks.length > 0) && (
                          <Box sx={{ mt: 2 }}>
                            <Button
                              size="small"
                              endIcon={selectedLocation.metadata.showLinks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setLocations(prev => prev.map(loc => 
                                  loc.id === selectedLocation.id 
                                    ? { 
                                        ...loc, 
                                        metadata: { 
                                          ...loc.metadata, 
                                          showLinks: !loc.metadata.showLinks 
                                        } 
                                      }
                                    : loc
                                ));
                              }}
                            >
                              {`${selectedLocation.metadata.referenceLinks.length} Reference Links`}
                            </Button>
                            <Collapse in={selectedLocation.metadata.showLinks}>
                              <List dense>
                                {selectedLocation.metadata.referenceLinks.map((link, index) => (
                                  <ListItem key={index}>
                                    <Link 
                                      href={link.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      {link.title || `Reference ${index + 1}`}
                                    </Link>
                                  </ListItem>
                                ))}
                              </List>
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
              value={editingLocation?.metadata?.address || ''}
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
                disabled={!!editingLocation?.metadata?.address}
              />
              <TextField
                label="Longitude"
                type="number"
                value={editingLocation?.longitude || ''}
                onChange={(e) => setEditingLocation(prev => prev ? {
                  ...prev,
                  longitude: parseFloat(e.target.value)
                } : null)}
                disabled={!!editingLocation?.metadata?.address}
              />
            </Box>
            {editingLocation?.type === 'college' && (
              <>
                <TextField
                  label="Website"
                  fullWidth
                  value={editingLocation.metadata?.website || ''}
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
                  value={editingLocation.metadata?.description || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, description: e.target.value }
                  } : null)}
                />
                <TextField
                  label="Fit Score"
                  type="number"
                  value={editingLocation.metadata?.fitScore || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, fitScore: parseFloat(e.target.value) }
                  } : null)}
                />
                <TextField
                  label="Reason"
                  fullWidth
                  multiline
                  rows={2}
                  value={editingLocation.metadata?.reason || ''}
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
                  value={editingLocation.metadata?.amount || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, amount: parseFloat(e.target.value) }
                  } : null)}
                />
                <TextField
                  label="Deadline"
                  fullWidth
                  value={editingLocation.metadata?.deadline || ''}
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
                  value={editingLocation.metadata?.eligibility || ''}
                  onChange={(e) => setEditingLocation(prev => prev ? {
                    ...prev,
                    metadata: { ...prev.metadata, eligibility: e.target.value }
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
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Location</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this location?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => selectedLocation && handleDeleteLocation(selectedLocation)}
            color="error"
            disabled={isProcessing}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
