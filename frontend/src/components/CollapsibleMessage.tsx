import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Collapse,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AiChatMessage } from '../types/college';
import DOMPurify from 'dompurify';

interface CollapsibleMessageProps {
  message: AiChatMessage;
  isLatest: boolean;
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({ message, isLatest }) => {
  const [expanded, setExpanded] = useState(true);
  const isCollapsible = message.role === 'thinking';
  
  // Auto-collapse thinking messages when they're no longer the latest
  useEffect(() => {
    if (isCollapsible && !isLatest) {
      setExpanded(false);
    }
  }, [isCollapsible, isLatest]);

  // Get preview text based on message type and content
  const getPreviewText = () => {
    const text = message.content || '';
    
    // For tool usage messages
    if (text.startsWith('Using ')) {
      return text.split('\n')[0]; // Show the "Using tool..." line
    }
    
    // For tool results
    if (text.startsWith('Tool ')) {
      return 'Tool result...';
    }
    
    // For thinking messages
    if (message.role === 'thinking') {
      return 'Thinking...';
    }
    
    // Default case: first line or first 50 characters
    const firstLine = text.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  };

  const messageContent = message.content || '';
  const hasToolData = message.toolData || 
                     messageContent.includes('Tool Data:') || 
                     (message.role === 'thinking' && 
                     (messageContent.includes('toolData') || 
                      messageContent.includes('Tool ') || 
                      messageContent.includes('Using ')));

  // Process analysis tags and JSON tool data
  const processContent = (content: string) => {
    // Handle tool data JSON formatting
    if (hasToolData) {
      // If we have separate toolData property, use that
      if (message.toolData) {
        try {
          const jsonData = JSON.parse(message.toolData);
          const prettyJson = JSON.stringify(jsonData, null, 2);
          
          return {
            mainContent: content,
            toolData: prettyJson,
            analysisContent: []
          };
        } catch (e) {
          console.warn("Failed to parse toolData JSON:", e);
          return {
            mainContent: content,
            toolData: message.toolData,
            analysisContent: []
          };
        }
      }
      
      // Legacy format - try to extract JSON from the content
      try {
        const jsonMatch = content.match(/(\{.*\}|\[.*\])/s);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            const prettyJson = JSON.stringify(jsonData, null, 2);
            return {
              mainContent: content.replace(jsonMatch[0], prettyJson),
              analysisContent: []
            };
          } catch (e) {
            // Ignore parsing errors for this attempt
          }
        }
      } catch (e) {
        // If JSON parsing fails, just continue with normal processing
        console.warn("Failed to parse JSON in content:", e);
      }
      return {
        mainContent: content,
        analysisContent: []
      };
    }
    
    // Extract content inside analysis tags
    const analysisRegex = /<analysis>([\s\S]*?)<\/analysis>/g;
    let analysisContent = [];
    let match;
    let contentWithoutAnalysis = content;
    
    while ((match = analysisRegex.exec(content)) !== null) {
      analysisContent.push(match[1]);
      contentWithoutAnalysis = contentWithoutAnalysis.replace(match[0], '');
    }
    
    return {
      mainContent: contentWithoutAnalysis.trim(),
      analysisContent: analysisContent
    };
  };

  const renderMessageContent = (content: string, showTimestamp: boolean = true) => {
    // Process content for any message type
    const processedContent = processContent(content);
    
    // For tool data, render as monospace with pretty-printed JSON
    if (hasToolData) {
      return (
        <Box>
          {/* Main thinking content */}
          <Typography sx={{ 
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            mb: processedContent.toolData ? 2 : 0
          }}>
            {processedContent.mainContent}
          </Typography>
          
          {/* Tool data in monospace if present */}
          {processedContent.toolData && (
            <Box sx={{ 
              backgroundColor: 'rgba(0,0,0,0.03)', 
              p: 1, 
              borderRadius: 1, 
              mt: 1,
              borderLeft: '3px solid #ddd' 
            }}>
              <Typography sx={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.85em'
              }}>
                {processedContent.toolData}
              </Typography>
            </Box>
          )}
          
          {showTimestamp && message.timestamp && renderTimestamp()}
        </Box>
      );
    }
    
    // We already processed the content above
    
    return (
      <Box>
        {/* Main content with HTML and tighter spacing */}
        <Box
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(processedContent.mainContent)
          }}
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            // Tighten spacing for HTML content
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              margin: '0.5em 0 0.3em 0',
              lineHeight: 1.2,
            },
            '& p': {
              margin: '0.5em 0',
              lineHeight: 1.4,
            },
            '& ul, & ol': {
              margin: '0.5em 0',
              paddingLeft: '1.5em',
            },
            '& li': {
              margin: '0.2em 0',
              lineHeight: 1.3,
            },
            '& div': {
              margin: '0.3em 0',
            },
            '& br': {
              lineHeight: 1.2,
            },
            // Remove excessive spacing from nested elements
            '& * + *': {
              marginTop: '0.5em',
            },
            '& *:first-child': {
              marginTop: 0,
            },
            '& *:last-child': {
              marginBottom: 0,
            },
          }}
        />
        
        {/* Analysis content if present */}
        {processedContent.analysisContent && processedContent.analysisContent.length > 0 && (
          <Box mt={2}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>
              Analysis details:
            </Typography>
            {processedContent.analysisContent.map((analysis, index) => (
              <Box 
                key={index} 
                sx={{ 
                  mt: 1, 
                  p: 1, 
                  bgcolor: 'rgba(0,0,0,0.03)',
                  borderLeft: '3px solid #ccc',
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {analysis}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        
        {showTimestamp && message.timestamp && renderTimestamp()}
      </Box>
    );
  };

  const renderTimestamp = () => (
    <Typography variant="caption" sx={{ 
      display: 'block',
      mt: 1,
      opacity: 0.7,
      textAlign: message.role === 'user' ? 'right' : 'left',
      color: message.role === 'user' || message.role === 'answer' || message.role === 'question' ? 'white' : 'text.secondary'
    }}>
      {new Date(message.timestamp).toLocaleTimeString()}
    </Typography>
  );

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        maxWidth: '80%',
        backgroundColor: 
          message.role === 'user' ? 'primary.main' : 
          message.role === 'thinking' ? 'grey.100' :
          message.role === 'answer' ? 'success.main' :
          message.role === 'question' ? 'info.main' :
          'background.paper',
        color: message.role === 'user' || message.role === 'answer' || message.role === 'question' ? 'white' : 'text.primary',
        pl: message.role === 'thinking' ? 4 : 2,
        fontStyle: message.role === 'thinking' ? 'italic' : 'normal'
      }}
    >
      {isCollapsible ? (
        <Box>
          <Box display="flex" alignItems="center">
            <IconButton
              onClick={() => setExpanded(!expanded)}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                mr: 1,
                p: 0.5
              }}
              size="small"
            >
              <ExpandMoreIcon />
            </IconButton>
            {!expanded && (
              <Typography sx={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: hasToolData ? 'monospace' : 'inherit',
                fontSize: hasToolData ? '0.85em' : 'inherit',
                opacity: 0.8
              }}>
                {getPreviewText()}
              </Typography>
            )}
          </Box>
          <Collapse in={expanded}>
            {renderMessageContent(messageContent)}
          </Collapse>
        </Box>
      ) : (
        renderMessageContent(messageContent)
      )}
    </Paper>
  );
};
