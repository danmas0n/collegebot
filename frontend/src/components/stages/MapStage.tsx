import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../utils/api';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  IconButton,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import { GoogleMap, useLoadScript, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useChat } from '../../contexts/ChatContext';
import { useWizard } from '../../contexts/WizardContext';
import { MapLocation } from '../../types/wizard';
import { AiChat } from '../../types/college';
import TourPlanningDialog from './TourPlanningDialog';
import { MapLocationList } from '../map/MapLocationList';
import { MapLocationInfoWindow } from '../map/MapLocationInfoWindow';
import { MapDebugControls } from '../map/MapDebugControls';
import { StageContainer, StageHeader } from './StageContainer';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 39.8283, // Center of US
  lng: -98.5795,
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = [];

export const MapStage = (): JSX.Element => {
  const { currentStudent } = useWizard();
  const { chats, loadChats } = useChat();
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
  const [isTourPlanningOpen, setIsTourPlanningOpen] = useState<boolean>(false);
  const [showProcessingLogs, setShowProcessingLogs] = useState<boolean>(true);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingTotal, setProcessingTotal] = useState<number>(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  
  // State for auto-processing in debug pane
  const [hasUnprocessedChats, setHasUnprocessedChats] = useState<boolean>(false);

  // Google Maps setup
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });
  
  // Reference to the Google Map instance
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Function to handle map load
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  
  // Function to center map on a location
  const centerMapOnLocation = useCallback((location: MapLocation) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
      mapRef.current.setZoom(10); // Zoom in when centering on a location
    }
  }, []);

  // Function to load map locations
  const loadLocations = useCallback(async (setLoadingState = true) => {
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
  }, [currentStudent?.id]);

  // Function to process all chats
  const handleProcessAllChats = useCallback(async () => {
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
  }, [currentStudent?.id, loadLocations, processingLogs]);

  // Function to mark all chats as unprocessed
  const handleMarkChatsUnprocessed = useCallback(async () => {
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
  }, [currentStudent?.id, chats, loadChats]);
  
  // Function to clear all map locations
  const handleClearAllLocations = useCallback(async () => {
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
  }, [currentStudent?.id]);
  
  // Function to delete a map location
  const handleDeleteLocation = useCallback(async (locationId: string) => {
    if (!currentStudent?.id) return;
    
    try {
      setIsLoading(true);
      const response = await api.post('/api/students/map-locations/delete', {
        studentId: currentStudent.id,
        locationId
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete locations: ${response.status}`);
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
  }, [currentStudent?.id, selectedLocation]);

  // Handle processing completion from debug pane
  const handleDebugProcessingComplete = useCallback(() => {
    setHasUnprocessedChats(false);
    setShowDebugControls(false); // Close the entire debug pane
  }, []);

  // Handle processing error
  const handleProcessingError = useCallback((error: string) => {
    setError(error);
  }, []);

  // Handle viewing a chat from map pin
  const { goToStage } = useWizard();
  const { setCurrentChat } = useChat();
  
  const handleViewChat = useCallback((chatId: string) => {
    // Find the chat
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      setCurrentChat(chat);
      // Use setTimeout to ensure the chat context is set before navigation
      setTimeout(() => {
        goToStage('recommendations');
      }, 100);
    }
  }, [chats, setCurrentChat, goToStage]);

  // Use a ref to track if we've processed chats for this session
  const processedRef = useRef(false);
  
  // Handle stage transitions and data loading
  const { currentStage } = useWizard();
  useEffect(() => {
    // Reset state when leaving map stage
    if (currentStage !== 'map') {
      setLocations([]);
      setProcessingStatus('');
      setProcessingLogs([]);
      setError(null);
      setHasUnprocessedChats(false);
      processedRef.current = false; // Reset the processed flag
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

        // Then load chats and use the returned value directly
        let loadedChats: AiChat[] = [];
        if (currentStudent?.id) {
          console.log('Loading chats...');
          loadedChats = await loadChats(currentStudent.id);
        }

        // Check for unprocessed chats using the loaded chats directly
        const hasUnprocessed = loadedChats.some(chat => !chat.processed);
        setHasUnprocessedChats(hasUnprocessed);
        
        // Auto-show debug controls if there are unprocessed chats
        if (hasUnprocessed && !processedRef.current) {
          console.log('Found unprocessed chats, showing debug controls');
          setShowDebugControls(true);
          processedRef.current = true; // Mark as processed for this session
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  // Keep minimal dependencies to prevent flickering
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
    <StageContainer ref={stageRef}>
      <StageHeader>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            College & Scholarship Map
          </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<MapIcon />}
            onClick={() => setIsTourPlanningOpen(true)}
            disabled={!currentStudent || isProcessing || locations.length === 0}
          >
            Plan Tour
          </Button>
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
      </StageHeader>

      <Collapse in={showDebugControls}>
        <MapDebugControls
          isProcessing={isProcessing}
          processingStatus={processingStatus}
          processingProgress={processingProgress}
          processingTotal={processingTotal}
          processingLogs={processingLogs}
          showProcessingLogs={showProcessingLogs}
          setShowProcessingLogs={setShowProcessingLogs}
          handleProcessAllChats={handleProcessAllChats}
          handleMarkChatsUnprocessed={handleMarkChatsUnprocessed}
          handleClearAllLocations={handleClearAllLocations}
          isLoading={isLoading}
          currentStudent={currentStudent}
          locationsLength={locations.length}
          hasUnprocessedChats={hasUnprocessedChats}
          onProcessingComplete={handleDebugProcessingComplete}
          onProcessingError={handleProcessingError}
          onLoadLocations={loadLocations}
        />
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
        <Box sx={{ 
          width: '100%', 
          display: 'flex', 
          gap: 2,
          height: 'calc(100vh - 300px)', // Use more available height
          minHeight: '600px' // Ensure minimum height
        }}>
          {/* Map View */}
          <Box sx={{ 
            flex: 1, 
            minWidth: 0,
            height: '100%'
          }}>
            <Box sx={{ width: '100%', height: '100%' }}>
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
                    <MapLocationInfoWindow
                      location={selectedLocation}
                      onDelete={handleDeleteLocation}
                      onViewChat={handleViewChat}
                      isLoading={isLoading}
                      chats={chats}
                    />
                  </InfoWindowF>
                )}
              </GoogleMap>
            </Box>
          </Box>
          
          {/* Location List */}
          <Box sx={{ width: 300, flexShrink: 0 }}>
            <MapLocationList
              locations={locations}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              centerMapOnLocation={centerMapOnLocation}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          </Box>
        </Box>
      )}
      
      {/* Tour Planning Dialog */}
      <TourPlanningDialog
        open={isTourPlanningOpen}
        onClose={() => setIsTourPlanningOpen(false)}
        locations={locations}
      />
    </StageContainer>
  );
};
