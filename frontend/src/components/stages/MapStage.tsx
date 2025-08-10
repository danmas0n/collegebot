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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  minHeight: '400px', // Ensure minimum height for Google Maps
  minWidth: '300px',  // Ensure minimum width for Google Maps
};

const defaultCenter = {
  lat: 39.8283, // Center of US
  lng: -98.5795,
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

// Utility function to handle overlapping markers by adding small offsets
const getMarkerPosition = (location: MapLocation, allLocations: MapLocation[]) => {
  const basePosition = { lat: location.latitude, lng: location.longitude };
  
  // Find all locations at the same coordinates (within a very small tolerance)
  const tolerance = 0.0001; // About 11 meters
  const overlappingLocations = allLocations.filter(loc => 
    Math.abs(loc.latitude - location.latitude) < tolerance &&
    Math.abs(loc.longitude - location.longitude) < tolerance
  );
  
  // If there's only one location at this position, return the original position
  if (overlappingLocations.length <= 1) {
    return basePosition;
  }
  
  // Find the index of this location among the overlapping ones
  const index = overlappingLocations.findIndex(loc => loc.id === location.id);
  
  // Create a small circular offset pattern
  const offsetDistance = 0.0005; // About 55 meters
  const angle = (index * 2 * Math.PI) / overlappingLocations.length;
  
  return {
    lat: basePosition.lat + offsetDistance * Math.cos(angle),
    lng: basePosition.lng + offsetDistance * Math.sin(angle)
  };
};

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
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
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
  const [autoProcessEnabled, setAutoProcessEnabled] = useState<boolean>(false);

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

  // Function to mark most recent chat as unprocessed
  const handleMarkRecentChatUnprocessed = useCallback(async () => {
    if (!currentStudent?.id) return;
    
    try {
      setIsProcessing(true);
      setProcessingStatus('Marking most recent chat as unprocessed...');
      
      const response = await api.post('/api/chat/mark-recent-unprocessed', {
        studentId: currentStudent.id
      });
      
      const data = await response.json();
      if (data.success) {
        setProcessingStatus(`Most recent chat "${data.chatTitle}" marked as unprocessed`);
        // Reload chats
        await loadChats(currentStudent.id);
      }
    } catch (err) {
      console.error('Error marking recent chat as unprocessed:', err);
      setError('Failed to mark recent chat as unprocessed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [currentStudent?.id, loadChats]);
  
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

  // Function to save a location (add or edit)
  const handleSaveLocation = useCallback(async () => {
    if (!currentStudent?.id || !editingLocation) return;
    
    // Validate form
    const errors: Record<string, string> = {};
    if (!editingLocation.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!editingLocation.latitude || editingLocation.latitude === 0) {
      errors.latitude = 'Latitude is required';
    }
    if (!editingLocation.longitude || editingLocation.longitude === 0) {
      errors.longitude = 'Longitude is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setLocationFormErrors(errors);
      return;
    }
    
    try {
      setIsLoading(true);
      setLocationFormErrors({});
      
      const response = await api.post('/api/students/map-locations', {
        studentId: currentStudent.id,
        ...editingLocation
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to save location: ${response.status}`);
      }
      
      // Reload locations to get the updated list
      await loadLocations();
      
      // Close dialog
      setIsEditDialogOpen(false);
      setEditingLocation(null);
      setError(null);
    } catch (err) {
      console.error('Error saving location:', err);
      setError('Failed to save location: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [currentStudent?.id, editingLocation, loadLocations]);

  // Function to handle location form changes
  const handleLocationFormChange = useCallback((field: string, value: any) => {
    if (!editingLocation) return;
    
    setEditingLocation(prev => prev ? {
      ...prev,
      [field]: value
    } : null);
    
    // Clear error for this field
    if (locationFormErrors[field]) {
      setLocationFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [editingLocation, locationFormErrors]);

  // Function to geocode an address
  const handleGeocodeAddress = useCallback(async () => {
    if (!locationAddress.trim() || !isLoaded) return;
    
    try {
      setIsGeocoding(true);
      setLocationFormErrors({});
      
      const geocoder = new google.maps.Geocoder();
      const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode({ address: locationAddress }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
      
      if (result.length > 0) {
        const location = result[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const formattedAddress = result[0].formatted_address;
        
        // Update the editing location with coordinates and address
        setEditingLocation(prev => prev ? {
          ...prev,
          latitude: lat,
          longitude: lng,
          metadata: {
            ...prev.metadata,
            address: formattedAddress
          }
        } : null);
        
        // Clear any previous errors
        setLocationFormErrors({});
      } else {
        setLocationFormErrors({ address: 'No results found for this address' });
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setLocationFormErrors({ 
        address: 'Failed to find location. Please check the address and try again.' 
      });
    } finally {
      setIsGeocoding(false);
    }
  }, [locationAddress, isLoaded]);

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <StageContainer 
      ref={stageRef} 
      data-testid="map-stage"
      sx={{
        height: showDebugControls ? 'auto' : 'calc(100vh - 64px)',
        minHeight: showDebugControls ? 'auto' : 'calc(100vh - 64px)',
        maxHeight: showDebugControls ? 'none' : 'calc(100vh - 64px)',
        overflow: showDebugControls ? 'visible' : 'hidden'
      }}
    >
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
              setLocationAddress('');
              setLocationFormErrors({});
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
          handleMarkRecentChatUnprocessed={handleMarkRecentChatUnprocessed}
          handleClearAllLocations={handleClearAllLocations}
          isLoading={isLoading}
          currentStudent={currentStudent}
          locationsLength={locations.length}
          hasUnprocessedChats={hasUnprocessedChats}
            onProcessingComplete={handleDebugProcessingComplete}
            onProcessingError={handleProcessingError}
            onLoadLocations={loadLocations}
            autoProcessEnabled={autoProcessEnabled}
            setAutoProcessEnabled={setAutoProcessEnabled}
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
          display: 'flex', 
          flexDirection: showDebugControls && (isProcessing || hasUnprocessedChats) ? 'column' : 'row',
          gap: 2,
          flex: 1,
          minWidth: 0,
          maxWidth: '100%',
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* Map View */}
          <Box sx={{ 
            flex: showDebugControls && (isProcessing || hasUnprocessedChats) ? '0 0 70vh' : 1, // Fixed height when debug panel is open
            minWidth: 0,
            maxWidth: '100%',
            height: showDebugControls && (isProcessing || hasUnprocessedChats) ? '70vh' : '100%',
            position: 'relative',
            overflow: 'hidden'
          }}>
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
                  position={getMarkerPosition(location, locations)}
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
          
          {/* Location List */}
          <Box sx={{ 
            width: { xs: '100%', md: '300px' },
            maxWidth: { xs: '100%', md: '300px' },
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            overflow: 'auto',
            height: '100%',
            minWidth: 0
          }}>
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

      {/* Add/Edit Location Dialog */}
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
          {editingLocation?.id?.startsWith('custom-') ? 'Add New Location' : 'Edit Location'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={editingLocation?.name || ''}
              onChange={(e) => handleLocationFormChange('name', e.target.value)}
              error={!!locationFormErrors.name}
              helperText={locationFormErrors.name}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={editingLocation?.type || 'college'}
                onChange={(e) => handleLocationFormChange('type', e.target.value)}
                label="Type"
              >
                <MenuItem value="college">College</MenuItem>
                <MenuItem value="scholarship">Scholarship</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Address"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                error={!!locationFormErrors.address}
                helperText={locationFormErrors.address || 'Enter the full address (e.g., "Harvard University, Cambridge, MA")'}
                placeholder="e.g., Harvard University, Cambridge, MA"
              />
              <Button
                variant="outlined"
                onClick={handleGeocodeAddress}
                disabled={!locationAddress.trim() || isGeocoding}
                sx={{ minWidth: '120px' }}
              >
                {isGeocoding ? <CircularProgress size={20} /> : 'Find Location'}
              </Button>
            </Box>
            
            {editingLocation?.latitude !== 0 && editingLocation?.longitude !== 0 && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="body2" color="success.dark">
                  ✓ Location found: {editingLocation?.latitude?.toFixed(6)}, {editingLocation?.longitude?.toFixed(6)}
                </Typography>
              </Box>
            )}
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Enter the address and click "Find Location" to automatically get the coordinates.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsEditDialogOpen(false);
              setEditingLocation(null);
              setLocationFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveLocation}
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </StageContainer>
  );
};
