import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../utils/api';
import DOMPurify from 'dompurify';
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
  Badge,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import SchoolIcon from '@mui/icons-material/School';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkIcon from '@mui/icons-material/Link';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useChat } from '../../contexts/ChatContext';
import { useWizard } from '../../contexts/WizardContext';
import { MapLocation } from '../../types/wizard';
import { useResearch } from '../../contexts/ResearchContext';

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
  const { tasks } = useResearch();
  const stageRef = React.useRef<HTMLDivElement>(null);
  
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
  const [sortBy, setSortBy] = useState<'name' | 'type'>('name');

  // Google Maps setup
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });
  
  // Reference to the Google Map instance
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Function to handle map load
  const onMapLoad = React.useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  
  // Function to center map on a location
  const centerMapOnLocation = (location: MapLocation) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
      mapRef.current.setZoom(10); // Zoom in when centering on a location
    }
  };

  // State for processing status
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingTotal, setProcessingTotal] = useState<number>(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [showProcessingLogs, setShowProcessingLogs] = useState<boolean>(true);

  // Function to process all chats
  const handleProcessAllChats = async () => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      setProcessingStatus('Processing chats...');
      setProcessingLogs([]);
      
      const response = await api.post('/api/chat/process-all', {
        studentId: currentStudent.id
      }, { stream: true });
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader');
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(5)); // Remove 'data: '
            
            if (data.type === 'thinking') {
              // Ensure content is a string before adding to logs
              const content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
              
              // Check if the previous log entry also has <analysis> tags
              // If so, we want to combine them to keep the analysis with the context
              const prevLog = processingLogs.length > 0 ? processingLogs[processingLogs.length - 1] : '';
              const hasPrevAnalysis = typeof prevLog === 'string' && 
                                      prevLog.includes('<analysis>') && 
                                      prevLog.includes('</analysis>');
              const hasCurrentAnalysis = content.includes('<analysis>') && content.includes('</analysis>');
              
              if (hasPrevAnalysis && !hasCurrentAnalysis) {
                // Append to previous log if it had an analysis section
                setProcessingLogs(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = prev[prev.length - 1] + '\n' + content;
                  return updated;
                });
              } else if (hasCurrentAnalysis && processingLogs.length > 0 && !hasPrevAnalysis) {
                // If this is an analysis message, append it to the previous regular message
                setProcessingLogs(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = prev[prev.length - 1] + '\n' + content;
                  return updated;
                });
              } else {
                // Otherwise add as a new log entry
                setProcessingLogs(prev => [...prev, content]);
              }
            } else if (data.type === 'status') {
              setProcessingStatus(data.content);
              if (data.total) setProcessingTotal(data.total);
              if (data.progress) setProcessingProgress(data.progress);
            } else if (data.type === 'complete') {
              try {
                // Add a final line to indicate completion
                setProcessingLogs(prev => [...prev, "✅ Processing complete"]);
                
                // Reload locations after processing
                await loadLocations();
              } catch (err) {
                console.error('Error loading locations after completion:', err);
                setError('Failed to refresh map data after processing');
              }
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error processing chats:', err);
      setError('Failed to process chats: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to mark all chats as unprocessed
  const handleMarkChatsUnprocessed = async () => {
    if (!currentStudent?.id || !chats?.length) return;
    
    try {
      setIsProcessing(true);
      setProcessingStatus('Marking chats as unprocessed...');
      
      await api.post('/api/chat/mark-unprocessed', {
        studentId: currentStudent.id,
        chatIds: chats.map(chat => chat.id)
      });
      
      // Reload chats
      await loadChats(currentStudent.id);
      
      setProcessingStatus('Chats marked as unprocessed');
    } catch (err) {
      console.error('Error marking chats as unprocessed:', err);
      setError('Failed to mark chats as unprocessed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to clear all map locations
  const handleClearAllLocations = async () => {
    if (!currentStudent?.id) return;
    
    // Confirm before deleting
    if (!window.confirm('Are you sure you want to clear ALL map locations? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await api.post('/api/students/map-locations/clear', {
        studentId: currentStudent.id
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to clear locations: ${response.status}`);
      }
      
      // Clear local state
      setLocations([]);
      setSelectedLocation(null);
      
    } catch (err) {
      console.error('Error clearing locations:', err);
      setError('Failed to clear locations: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load map locations
  const loadLocations = async (setLoadingState = true) => {
    if (!currentStudent?.id) {
      setLocations([]);
      return;
    }

    try {
      if (setLoadingState) setIsLoading(true);
      const response = await api.post('/api/students/map-locations/get', {
        studentId: currentStudent.id
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to load locations: ${response.status}`);
      }
      const data = await response.json();
      console.log('Loaded map locations:', data);
      setLocations(data);
    } catch (err) {
      console.error('Error loading locations:', err);
      setError('Failed to load locations: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      if (setLoadingState) setIsLoading(false);
    }
  };
  
  // Function to delete a map location
  const handleDeleteLocation = async (locationId: string) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsLoading(true);
      const response = await api.post('/api/students/map-locations/delete', {
        studentId: currentStudent.id,
        locationId
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete location: ${response.status}`);
      }
      
      // Remove from local state
      setLocations(prev => prev.filter(location => location.id !== locationId));
      
      // Close the info window if the deleted location is selected
      if (selectedLocation?.id === locationId) {
        setSelectedLocation(null);
      }
      
      // Show success message
      setError(null);
    } catch (err) {
      console.error('Error deleting location:', err);
      setError('Failed to delete location: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle stage transitions and data loading
  const { currentStage } = useWizard();
  useEffect(() => {
    // Reset state when leaving map stage
    if (currentStage !== 'map') {
      setLocations([]);
      setProcessingStatus('');
      setProcessingLogs([]);
      setError(null);
      return;
    }

    // Load data when entering map stage
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setProcessingStatus('');
        setProcessingLogs([]);

        // Load locations first
        console.log('Loading locations...');
        await loadLocations(false); // Don't set loading state since we're managing it here

        // Then load chats
        if (currentStudent?.id) {
          console.log('Loading chats...');
          await loadChats(currentStudent.id);
        }

        // Show debug controls if there are unprocessed chats
        if (chats?.some(chat => !chat.processed)) {
          console.log('Found unprocessed chats, showing debug controls');
          setShowDebugControls(true);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentStudent?.id, currentStage]);


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
    <Paper elevation={0} sx={{ p: 3 }} ref={stageRef}>
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

      <Collapse in={showDebugControls}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Debug Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcessAllChats}
              disabled={isProcessing || !currentStudent}
            >
              Process All Chats
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleMarkChatsUnprocessed}
              disabled={isProcessing || !currentStudent}
            >
              Mark All Chats Unprocessed
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleClearAllLocations}
              disabled={isLoading || isProcessing || !currentStudent || locations.length === 0}
            >
              Clear All Locations
            </Button>
          </Box>
          
          {/* Processing status and logs */}
          {isProcessing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">{typeof processingStatus === 'object' ? JSON.stringify(processingStatus) : processingStatus}</Typography>
              <LinearProgress 
                variant={processingTotal > 0 ? "determinate" : "indeterminate"} 
                value={processingTotal > 0 ? (processingProgress / processingTotal) * 100 : 0}
                sx={{ my: 1 }}
              />
              <Collapse in={showProcessingLogs}>
                <Paper variant="outlined" sx={{ p: 1, mt: 1, maxHeight: 400, overflow: 'auto' }}>
                  {processingLogs.map((log, index) => {
                    // Parse JSON strings if needed
                    let parsedLog: any = log;
                    if (typeof log === 'string' && log.trim().startsWith('{') && log.includes('"type"')) {
                      try {
                        parsedLog = JSON.parse(log);
                      } catch (e) {
                        // If parsing fails, keep the original string
                        console.warn('Failed to parse log JSON:', e);
                      }
                    }
                    
                    // Process based on content type
                    let content: string = '';
                    let toolData: string | undefined;
                    
                    if (typeof parsedLog === 'object' && parsedLog !== null) {
                      // Extract toolData if present
                      if (parsedLog.toolData) {
                        toolData = parsedLog.toolData;
                        try {
                          // Try to format toolData as pretty JSON
                          if (typeof toolData === 'string') {
                            const jsonData = JSON.parse(toolData);
                            toolData = JSON.stringify(jsonData, null, 2);
                          }
                        } catch (e) {
                          // Keep original if can't parse
                        }
                      }
                      
                      // Format main content
                      content = parsedLog.content || JSON.stringify(parsedLog);
                    } else {
                      content = typeof parsedLog === 'object' ? JSON.stringify(parsedLog) : parsedLog;
                    }
                    
                    // Check if content contains <analysis> tags
                    const isAnalysis = typeof content === 'string' && content.includes('<analysis>') && content.includes('</analysis>');
                    
                    if (isAnalysis) {
                      // Extract and format analysis content
                      // Make sure content is a string before using string methods
                      const contentStr = typeof content === 'string' ? content : '';
                      const analysisMatch = contentStr.match(/<analysis>([\s\S]*?)<\/analysis>/);
                      const analysisContent = analysisMatch ? analysisMatch[1].trim() : '';
                      const regularContent = contentStr.replace(/<analysis>[\s\S]*?<\/analysis>/, '').trim();
                      
                      return (
                        <Box key={index} sx={{ mb: 2 }}>
                          {regularContent && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                whiteSpace: 'pre-wrap', 
                                mb: 1,
                                fontFamily: 'monospace', 
                                fontSize: '0.85rem' 
                              }}
                            >
                              {regularContent}
                            </Typography>
                          )}
                          {analysisContent && (
                            <Paper 
                              elevation={0} 
                              sx={{ 
                                p: 1.5, 
                                bgcolor: 'grey.100', 
                                borderLeft: '4px solid', 
                                borderColor: 'info.main',
                                fontStyle: 'italic'
                              }}
                            >
                              <Typography 
                                variant="subtitle2" 
                                color="info.main" 
                                sx={{ mb: 0.5, fontWeight: 'bold' }}
                              >
                                Analysis
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace', 
                                  fontSize: '0.85rem' 
                                }}
                              >
                                {analysisContent}
                              </Typography>
                            </Paper>
                          )}
                        </Box>
                      );
                    } else {
                      // Check if content looks like HTML (contains HTML tags)
                      const isHtml = typeof content === 'string' && content !== undefined && 
                        (content.includes('<h') || 
                         content.includes('<p>') || 
                         content.includes('<ul>') || 
                         content.includes('<ol>') ||
                         content.includes('<div'));
                         
                      if (isHtml) {
                        // Render as HTML with DOMPurify sanitization
                        return (
                          <Box 
                            key={index}
                            className="ai-message-html"
                            sx={{ mb: 1 }}
                            dangerouslySetInnerHTML={{ 
                              __html: typeof DOMPurify !== 'undefined' 
                                ? DOMPurify.sanitize(content)
                                : content // Fallback if DOMPurify not available
                            }}
                          />
                        );
                      }
                      
                      // Display toolData if available
                      if (toolData) {
                        return (
                          <Box key={index} sx={{ mb: 2 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                whiteSpace: 'pre-wrap',
                                mb: 1
                              }}
                            >
                              {content}
                            </Typography>
                            <Box sx={{ 
                              backgroundColor: 'rgba(0,0,0,0.03)', 
                              p: 1, 
                              borderRadius: 1, 
                              mt: 1,
                              borderLeft: '3px solid #ddd' 
                            }}>
                              <Typography 
                                variant="body2"
                                sx={{ 
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'monospace', 
                                  fontSize: '0.85rem' 
                                }}
                              >
                                {toolData}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }
                      
                      // Regular log entry (non-HTML)
                      return (
                        <Typography 
                          key={index} 
                          variant="body2" 
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            mb: 1,
                            fontFamily: typeof content === 'string' && (content.includes('Tool') || content.includes('Using')) ? 'monospace' : 'inherit', 
                            fontSize: typeof content === 'string' && (content.includes('Tool') || content.includes('Using')) ? '0.85rem' : 'inherit' 
                          }}
                        >
                          {content}
                        </Typography>
                      );
                    }
                  })}
                </Paper>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button 
                    size="small"
                    onClick={() => setShowProcessingLogs(!showProcessingLogs)}
                    startIcon={showProcessingLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  >
                    {showProcessingLogs ? 'Hide' : 'Show'} Logs
                  </Button>
                </Box>
              </Collapse>
            </Box>
          )}
        </Paper>
      </Collapse>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!currentStudent ? (
        <Typography>Please select a student first.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {/* Map View */}
          <Grid item xs={12} md={8}>
            <Box sx={{ width: '100%', height: '600px' }}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={defaultCenter}
                zoom={4}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                }}
                onLoad={onMapLoad}
              >
                {locations.map((location) => (
                  <MarkerF
                    key={location.id}
                    position={{
                      lat: location.latitude,
                      lng: location.longitude,
                    }}
                    onClick={() => {
                      setSelectedLocation(location);
                      centerMapOnLocation(location);
                    }}
                    icon={{
                      url: location.type === 'college' 
                        ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' 
                        : 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    }}
                  />
                ))}
                
                {selectedLocation && (
                  <InfoWindowF
                    position={{
                      lat: selectedLocation.latitude,
                      lng: selectedLocation.longitude,
                    }}
                    onCloseClick={() => setSelectedLocation(null)}
                  >
                    <Box sx={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="h6" fontWeight="bold">
                        {selectedLocation.name}
                      </Typography>
                      
                      {/* Basic Info */}
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {selectedLocation.metadata.address || 'No address available'}
                      </Typography>
                      
                      {selectedLocation.metadata.description && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {selectedLocation.metadata.description}
                        </Typography>
                      )}
                      
                      {/* College-specific info */}
                      {selectedLocation.type === 'college' && (
                        <>
                          {selectedLocation.metadata.reason && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              <strong>Why it's a good fit:</strong> {selectedLocation.metadata.reason}
                            </Typography>
                          )}
                          
                          {selectedLocation.metadata.acceptanceRate !== undefined && (
                            <Typography variant="body2">
                              <strong>Acceptance Rate:</strong> {(selectedLocation.metadata.acceptanceRate * 100).toFixed(1)}%
                            </Typography>
                          )}
                          
                          {selectedLocation.metadata.costOfAttendance?.total && (
                            <Typography variant="body2">
                              <strong>Cost of Attendance:</strong> ${selectedLocation.metadata.costOfAttendance.total.toLocaleString()}
                            </Typography>
                          )}
                          
                          {/* Merit Scholarships */}
                          {selectedLocation.metadata.meritScholarships && (
                            <Typography variant="body2">
                              <strong>Merit Scholarships:</strong> ${selectedLocation.metadata.meritScholarships.minAmount.toLocaleString()} - 
                              ${selectedLocation.metadata.meritScholarships.maxAmount.toLocaleString()}
                            </Typography>
                          )}
                        </>
                      )}
                      
                      {/* Scholarship-specific info */}
                      {selectedLocation.type === 'scholarship' && (
                        <>
                          {selectedLocation.metadata.amount && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              <strong>Amount:</strong> ${selectedLocation.metadata.amount.toLocaleString()}
                            </Typography>
                          )}
                          
                          {selectedLocation.metadata.deadline && (
                            <Typography variant="body2">
                              <strong>Deadline:</strong> {new Date(selectedLocation.metadata.deadline).toLocaleDateString()}
                            </Typography>
                          )}
                          
                          {selectedLocation.metadata.eligibility && (
                            <Typography variant="body2">
                              <strong>Eligibility:</strong> {selectedLocation.metadata.eligibility}
                            </Typography>
                          )}
                          
                          {selectedLocation.metadata.applicationUrl && (
                            <Link 
                              href={selectedLocation.metadata.applicationUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              sx={{ display: 'block', mt: 1 }}
                            >
                              Apply Now
                            </Link>
                          )}
                        </>
                      )}
                      
                      {/* Reference Links */}
                      {selectedLocation.metadata.referenceLinks && selectedLocation.metadata.referenceLinks.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Related Links
                          </Typography>
                          <List dense disablePadding>
                            {selectedLocation.metadata.referenceLinks.map((link, index) => (
                              <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                                <ListItemText
                                  primary={
                                    <Link 
                                      href={link.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                    >
                                      {link.title || link.url}
                                    </Link>
                                  }
                                  secondary={link.category}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                      
                      {/* Main Website Link */}
                      {selectedLocation.metadata.website && (
                        <Button
                          variant="outlined"
                          size="small"
                          component={Link}
                          href={selectedLocation.metadata.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ mt: 2, display: 'block' }}
                        >
                          Visit Official Website
                        </Button>
                      )}
                      
                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent the click from bubbling to the map
                            if (window.confirm(`Are you sure you want to delete ${selectedLocation.name}?`)) {
                              handleDeleteLocation(selectedLocation.id);
                            }
                          }}
                          disabled={isLoading}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Box>
                  </InfoWindowF>
                )}
              </GoogleMap>
            </Box>
          </Grid>
          
          {/* Location List */}
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ p: 2, height: '600px', overflow: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Map Locations
                </Typography>
                <Button
                  size="small"
                  startIcon={<SortByAlphaIcon />}
                  onClick={() => setSortBy(sortBy === 'name' ? 'type' : 'name')}
                >
                  Sort by {sortBy === 'name' ? 'Type' : 'Name'}
                </Button>
              </Box>
              
              {locations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No locations found. Add locations using the "Add Location" button.
                </Typography>
              ) : (
                <List>
                  {[...locations]
                    .sort((a, b) => {
                      if (sortBy === 'name') {
                        return a.name.localeCompare(b.name);
                      } else {
                        // Sort by type first, then by name
                        return a.type === b.type 
                          ? a.name.localeCompare(b.name) 
                          : a.type.localeCompare(b.type);
                      }
                    })
                    .map((location) => (
                    <ListItem 
                      key={location.id}
                      button
                      onClick={() => {
                        setSelectedLocation(location);
                        centerMapOnLocation(location);
                      }}
                      sx={{
                        bgcolor: selectedLocation?.id === location.id ? 'action.selected' : 'inherit',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemIcon>
                        {location.type === 'college' ? (
                          location.metadata.referenceLinks && location.metadata.referenceLinks.length > 0 ? (
                            <Badge 
                              badgeContent={<LinkIcon fontSize="small" />} 
                              color="primary"
                              anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                              }}
                              sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', width: 16, height: 16 } }}
                            >
                              <SchoolIcon color="primary" />
                            </Badge>
                          ) : (
                            <SchoolIcon color="primary" />
                          )
                        ) : (
                          location.metadata.referenceLinks && location.metadata.referenceLinks.length > 0 ? (
                            <Badge 
                              badgeContent={<LinkIcon fontSize="small" />} 
                              color="success"
                              anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                              }}
                              sx={{ '& .MuiBadge-badge': { fontSize: '0.5rem', width: 16, height: 16 } }}
                            >
                              <AttachMoneyIcon color="success" />
                            </Badge>
                          ) : (
                            <AttachMoneyIcon color="success" />
                          )
                        )}
                      </ListItemIcon>
                      <ListItemText 
                        primary={location.name}
                        secondary={
                          <>
                            {location.metadata.address || 'No address available'}
                            {location.type === 'college' && location.metadata.acceptanceRate !== undefined && (
                              <Box component="span" sx={{ display: 'block' }}>
                                Acceptance: {(location.metadata.acceptanceRate * 100).toFixed(1)}%
                              </Box>
                            )}
                            {location.type === 'scholarship' && location.metadata.amount && (
                              <Box component="span" sx={{ display: 'block' }}>
                                Amount: ${location.metadata.amount.toLocaleString()}
                              </Box>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Paper>
  );
};
