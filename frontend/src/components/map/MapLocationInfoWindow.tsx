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
  Tooltip,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CalculateIcon from '@mui/icons-material/Calculate';
import { MapLocation } from '../../types/wizard';

interface MapLocationInfoWindowProps {
  location: MapLocation;
  onDelete: (locationId: string) => void;
  onViewChat?: (chatId: string) => void;
  isLoading: boolean;
  chats?: Array<{ id: string; title?: string; updatedAt: string }>;
}

// Helper function to get tier badge color and label
const getTierBadge = (tier?: string) => {
  switch (tier) {
    case 'reach':
      return { color: 'error' as const, label: 'Reach' };
    case 'target':
      return { color: 'warning' as const, label: 'Target' };
    case 'safety':
      return { color: 'success' as const, label: 'Safety' };
    case 'likely':
      return { color: 'info' as const, label: 'Likely' };
    case 'uncategorized':
    default:
      return { color: 'default' as const, label: 'Uncategorized' };
  }
};

export const MapLocationInfoWindow: React.FC<MapLocationInfoWindowProps> = ({
  location,
  onDelete,
  onViewChat,
  isLoading,
  chats,
}) => {
  const tierBadge = location.type === 'college' && location.tier ? getTierBadge(location.tier) : null;
  
  return (
    <Box sx={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
          {location.name}
        </Typography>
        {tierBadge && (
          <Tooltip title={location.tierReasoning || 'AI-assigned tier'}>
            <Chip 
              label={tierBadge.label} 
              color={tierBadge.color} 
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Tooltip>
        )}
        {location.type === 'college' && location.metadata?.financial?.meritAidLikelihood && (
          <Tooltip title={location.metadata.financial.meritAidReasoning || 'Merit aid likelihood'}>
            <Chip 
              label={`Merit: ${location.metadata.financial.meritAidLikelihood.charAt(0).toUpperCase() + location.metadata.financial.meritAidLikelihood.slice(1)}`}
              color={
                location.metadata.financial.meritAidLikelihood === 'high' ? 'success' :
                location.metadata.financial.meritAidLikelihood === 'medium' ? 'warning' :
                location.metadata.financial.meritAidLikelihood === 'low' ? 'default' : 'error'
              }
              size="small"
            />
          </Tooltip>
        )}
      </Box>
      
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
      
      {/* Net Price Calculator Link */}
      {location.type === 'college' && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<CalculateIcon />}
          onClick={() => window.open('https://collegecost.ed.gov/net-price', '_blank')}
          sx={{ mt: 1, display: 'block' }}
        >
          Calculate Net Price
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
