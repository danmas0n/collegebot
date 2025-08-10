import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
  Collapse,
  IconButton,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DOMPurify from 'dompurify';
import { StreamingChatInterface } from '../shared/StreamingChatInterface';

interface MapDebugControlsProps {
  isProcessing: boolean;
  processingStatus: string;
  processingProgress: number;
  processingTotal: number;
  processingLogs: string[];
  showProcessingLogs: boolean;
  setShowProcessingLogs: (show: boolean) => void;
  handleProcessAllChats: () => Promise<void>;
  handleMarkChatsUnprocessed: () => Promise<void>;
  handleMarkRecentChatUnprocessed: () => Promise<void>;
  handleClearAllLocations: () => Promise<void>;
  isLoading: boolean;
  currentStudent: any;
  locationsLength: number;
  // New props for auto-processing
  hasUnprocessedChats: boolean;
  onProcessingComplete: () => void;
  onProcessingError: (error: string) => void;
  onLoadLocations: () => Promise<void>;
  // Auto-processing control
  autoProcessEnabled: boolean;
  setAutoProcessEnabled: (enabled: boolean) => void;
}

export const MapDebugControls: React.FC<MapDebugControlsProps> = ({
  isProcessing,
  processingStatus,
  processingProgress,
  processingTotal,
  processingLogs,
  showProcessingLogs,
  setShowProcessingLogs,
  handleProcessAllChats,
  handleMarkChatsUnprocessed,
  handleMarkRecentChatUnprocessed,
  handleClearAllLocations,
  isLoading,
  currentStudent,
  locationsLength,
  hasUnprocessedChats,
  onProcessingComplete,
  onProcessingError,
  onLoadLocations,
  autoProcessEnabled,
  setAutoProcessEnabled,
}) => {
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [streamingComplete, setStreamingComplete] = useState(false);

  // Auto-start processing when there are unprocessed chats AND auto-processing is enabled
  useEffect(() => {
    if (hasUnprocessedChats && !isAutoProcessing && !isProcessing && autoProcessEnabled) {
      setIsAutoProcessing(true);
      setStreamingComplete(false);
    }
  }, [hasUnprocessedChats, isAutoProcessing, isProcessing, autoProcessEnabled]);

  // Handle processing completion with countdown
  const handleStreamingProcessingComplete = async () => {
    console.log('StreamingChatInterface processing complete');
    setStreamingComplete(true);
    setCountdown(10); // Start 10-second countdown
    // Reload locations after processing
    await onLoadLocations();
  };

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && streamingComplete) {
      // Auto-collapse after countdown reaches 0
      console.log('Countdown finished, calling onProcessingComplete');
      setIsAutoProcessing(false);
      setStreamingComplete(false);
      onProcessingComplete();
    }
  }, [countdown, streamingComplete, onProcessingComplete]);

  return (
    <Paper sx={{ 
      p: 2, 
      mb: 2
    }}>
      <Typography variant="h6" gutterBottom>
        Chat Processing
      </Typography>
      
      {/* Auto-processing control */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={autoProcessEnabled}
              onChange={(e) => setAutoProcessEnabled(e.target.checked)}
              disabled={isProcessing}
            />
          }
          label="Auto-process unprocessed chats when Map loads"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: 0.5 }}>
          When enabled, unprocessed chats will be automatically processed when you open the Map stage.
          This is disabled by default since the Recommendations stage already creates map pins.
        </Typography>
      </Box>
      
      {/* Control buttons */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        flexWrap: 'wrap', 
        mb: 2
      }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setIsManualProcessing(true)}
          disabled={isProcessing || isManualProcessing || !currentStudent}
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
          color="info"
          onClick={handleMarkRecentChatUnprocessed}
          disabled={isProcessing || !currentStudent}
        >
          Mark Most Recent Chat Unprocessed
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={handleClearAllLocations}
          disabled={isLoading || isProcessing || !currentStudent || locationsLength === 0}
        >
          Clear All Locations
        </Button>
      </Box>
      
      {/* Auto-processing StreamingChatInterface */}
      {isAutoProcessing && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Processing Chats for Map Locations
          </Typography>
          <StreamingChatInterface
            mode="processing"
            autoStart={true}
            processingEndpoint="/api/chat/process-all"
            onProcessingComplete={handleStreamingProcessingComplete}
            onProcessingError={onProcessingError}
            title=""
            description=""
            operationType="map"
            llmOperationType="map-processing"
            operationDescription="Processing chats to extract map locations"
            viewMode="collapsed"
          />
          {countdown > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                Processing complete! Auto-collapsing processing panel in {countdown} seconds...
              </Typography>
            </Box>
          )}
        </Box>
      )}
      
      {/* Manual processing StreamingChatInterface */}
      {isManualProcessing && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Manual Chat Processing
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsManualProcessing(false)}
            >
              Close
            </Button>
          </Box>
          <StreamingChatInterface
            mode="processing"
            autoStart={true}
            processingEndpoint="/api/chat/process-all"
            onProcessingComplete={async () => {
              await onLoadLocations();
              setIsManualProcessing(false);
            }}
            onProcessingError={onProcessingError}
            title=""
            description=""
            operationType="map"
            llmOperationType="map-processing"
            operationDescription="Processing chats to extract map locations"
            viewMode="full"
          />
        </Box>
      )}
      
      {/* Processing status and logs (legacy - only show when not using StreamingChatInterface) */}
      {isProcessing && !isAutoProcessing && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">{typeof processingStatus === 'object' ? JSON.stringify(processingStatus) : processingStatus}</Typography>
          <LinearProgress 
            variant={processingTotal > 0 ? "determinate" : "indeterminate"} 
            value={processingTotal > 0 ? (processingProgress / processingTotal) * 100 : 0}
            sx={{ my: 1 }}
          />
          <Collapse in={showProcessingLogs}>
            <Paper variant="outlined" sx={{ 
              p: 1, 
              mt: 1, 
              maxHeight: 400, 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                '&::-webkit-scrollbar': {
                  width: '8px'
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#888',
                  borderRadius: '4px'
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: '#555'
                }
              }}>
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
              </Box>
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
  );
};
