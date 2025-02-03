import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  IconButton,
  Box,
  Collapse
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AiChatMessage } from '../types/college';

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
  const hasToolData = messageContent.includes('Tool Data:');

  const renderMessageContent = (content: string, showTimestamp: boolean = true) => (
    <Box>
      <Typography sx={{ 
        whiteSpace: 'pre-wrap',
        fontFamily: hasToolData ? 'monospace' : 'inherit',
        fontSize: hasToolData ? '0.85em' : 'inherit'
      }}>
        {content}
      </Typography>
      {showTimestamp && message.timestamp && (
        <Typography variant="caption" sx={{ 
          display: 'block',
          mt: 1,
          opacity: 0.7,
          textAlign: message.role === 'user' ? 'right' : 'left',
          color: message.role === 'user' || message.role === 'answer' || message.role === 'question' ? 'white' : 'text.secondary'
        }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      )}
    </Box>
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
