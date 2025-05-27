import React from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Link,
  Chip,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { MapLocation } from '../../types/wizard';

interface MapLocationInfoWindowProps {
  location: MapLocation;
  onDelete: (locationId: string) => void;
  onViewChat?: (chatId: string) => void;
  isLoading: boolean;
  chats?: Array<{ id: string; title?: string; updatedAt: string }>;
}

export const MapLocationInfoWindow: React.FC<MapLocationInfoWindowProps> = ({
  location,
  onDelete,
  onViewChat,
  isLoading,
  chats,
}) => {
  return (
    <Box sx={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <Typography variant="h6" fontWeight="bold">
        {location.name}
      </Typography>
      
      {/* Basic Info */}
      <Typography variant="body2" sx={{ mt: 1 }}>
        {location.metadata.address || 'No address available'}
      </Typography>
      
      {location.metadata.description && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {location.metadata.description}
        </Typography>
      )}
      
      {/* College-specific info */}
      {location.type === 'college' && (
        <>
          {location.metadata.reason && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Why it's a good fit:</strong> {location.metadata.reason}
            </Typography>
          )}
          
          {location.metadata.acceptanceRate !== undefined && (
            <Typography variant="body2">
              <strong>Acceptance Rate:</strong> {(location.metadata.acceptanceRate * 100).toFixed(1)}%
            </Typography>
          )}
          
          {location.metadata.costOfAttendance?.total && (
            <Typography variant="body2">
              <strong>Cost of Attendance:</strong> ${location.metadata.costOfAttendance.total.toLocaleString()}
            </Typography>
          )}
          
          {/* Merit Scholarships */}
          {location.metadata.meritScholarships && (
            <Typography variant="body2">
              <strong>Merit Scholarships:</strong> ${location.metadata.meritScholarships.minAmount.toLocaleString()} - 
              ${location.metadata.meritScholarships.maxAmount.toLocaleString()}
            </Typography>
          )}
        </>
      )}
      
      {/* Scholarship-specific info */}
      {location.type === 'scholarship' && (
        <>
          {location.metadata.amount && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Amount:</strong> ${location.metadata.amount.toLocaleString()}
            </Typography>
          )}
          
          {location.metadata.deadline && (
            <Typography variant="body2">
              <strong>Deadline:</strong> {new Date(location.metadata.deadline).toLocaleDateString()}
            </Typography>
          )}
          
          {location.metadata.eligibility && (
            <Typography variant="body2">
              <strong>Eligibility:</strong> {location.metadata.eligibility}
            </Typography>
          )}
          
          {location.metadata.applicationUrl && (
            <Link 
              href={location.metadata.applicationUrl} 
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
      {location.metadata.referenceLinks && location.metadata.referenceLinks.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Related Links
          </Typography>
          <List dense disablePadding>
            {location.metadata.referenceLinks.map((link, index) => (
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

      {/* Related Conversations */}
      {location.sourceChats && location.sourceChats.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Related Conversations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            This location was mentioned in {location.sourceChats.length} conversation{location.sourceChats.length > 1 ? 's' : ''}
          </Typography>
          <List dense disablePadding>
            {location.sourceChats.map((chatId, index) => {
              const chat = chats?.find(c => c.id === chatId);
              return (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ChatIcon fontSize="small" color="primary" />
                        {chat ? (
                          <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewChat?.(chatId);
                            }}
                            sx={{ textAlign: 'left', justifyContent: 'flex-start', p: 0 }}
                          >
                            {chat.title || 'Untitled Chat'}
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Chat no longer available
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={chat ? new Date(chat.updatedAt).toLocaleDateString() : null}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
      
      {/* Main Website Link */}
      {location.metadata.website && (
        <Button
          variant="outlined"
          size="small"
          component={Link}
          href={location.metadata.website}
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
            if (window.confirm(`Are you sure you want to delete ${location.name}?`)) {
              onDelete(location.id);
            }
          }}
          disabled={isLoading}
        >
          Delete
        </Button>
      </Box>
    </Box>
  );
};
