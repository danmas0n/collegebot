import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Badge,
} from '@mui/material';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import SchoolIcon from '@mui/icons-material/School';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LinkIcon from '@mui/icons-material/Link';
import { MapLocation } from '../../types/wizard';

interface MapLocationListProps {
  locations: MapLocation[];
  selectedLocation: MapLocation | null;
  setSelectedLocation: (location: MapLocation) => void;
  centerMapOnLocation: (location: MapLocation) => void;
  sortBy: 'name' | 'type';
  setSortBy: (sortBy: 'name' | 'type') => void;
}

export const MapLocationList: React.FC<MapLocationListProps> = ({
  locations,
  selectedLocation,
  setSelectedLocation,
  centerMapOnLocation,
  sortBy,
  setSortBy,
}) => {
  return (
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
  );
};
