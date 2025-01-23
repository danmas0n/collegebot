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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

                    // Wait for processed count update
                    await new Promise<void>(resolve => {
                      setProcessedCount(prev => {
                        resolve();
                        return prev + 1;
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
          <>
            <Button 
              variant="outlined"
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
          </>
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

      {/* Stream Outputs */}
      {streams.map(stream => (
        <Paper key={stream.id} elevation={1} sx={{ mb: 2, backgroundColor: '#f5f5f5' }}>
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

      {!currentStudent ? (
        <Typography>Please select a student first.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
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
                  <div>
                    <Typography variant="subtitle1">{selectedLocation.name}</Typography>
                    {selectedLocation.metadata.website && (
                      <Typography variant="body2">
                        <a 
                          href={selectedLocation.metadata.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Visit Website
                        </a>
                      </Typography>
                    )}
                    {selectedLocation.metadata.description && (
                      <Typography variant="body2">
                        {selectedLocation.metadata.description}
                      </Typography>
                    )}
                    {selectedLocation.type === 'college' && (
                      <>
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
                      </>
                    )}
                    {selectedLocation.type === 'scholarship' && (
                      <>
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
                      </>
                    )}
                  </div>
                </InfoWindowF>
              )}
            </GoogleMap>
          </CardContent>
        </Card>
      )}
    </Paper>
  );
};
