import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import MapIcon from '@mui/icons-material/Map';
import DirectionsIcon from '@mui/icons-material/Directions';
import SortIcon from '@mui/icons-material/Sort';
import { MapLocation } from '../../types/wizard';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DropResult } from 'react-beautiful-dnd';

interface TourPlanningDialogProps {
  open: boolean;
  onClose: () => void;
  locations: MapLocation[];
}

type TourOption = 'google-maps' | 'in-app';

export default function TourPlanningDialog({ open, onClose, locations }: TourPlanningDialogProps): JSX.Element {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [tourOption, setTourOption] = useState<TourOption>('google-maps');
  const [tourOrder, setTourOrder] = useState<MapLocation[]>([]);
  const [optimizeRoute, setOptimizeRoute] = useState<boolean>(true);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedLocations([]);
      setTourOption('google-maps');
      setTourOrder([]);
      setOptimizeRoute(true);
    }
  }, [open]);

  // Update tour order when selected locations change
  React.useEffect(() => {
    const orderedLocations = locations.filter(loc => 
      selectedLocations.includes(loc.id)
    );
    setTourOrder(orderedLocations);
  }, [selectedLocations, locations]);

  const handleToggleLocation = (locationId: string) => {
    setSelectedLocations(prev => {
      if (prev.includes(locationId)) {
        return prev.filter(id => id !== locationId);
      } else {
        return [...prev, locationId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(locations.map(loc => loc.id));
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(tourOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setTourOrder(items);
    setOptimizeRoute(false); // Turn off optimization when manually reordering
  };

  const handleOpenInGoogleMaps = () => {
    if (tourOrder.length === 0) return;
    
    // Format for Google Maps URL
    // https://www.google.com/maps/dir/?api=1&origin=ORIGIN&destination=DESTINATION&waypoints=WAYPOINT1|WAYPOINT2|...
    
    let url = 'https://www.google.com/maps/dir/?api=1';
    
    // Add origin (first location)
    const origin = tourOrder[0];
    url += `&origin=${encodeURIComponent(origin.name)}`;
    
    // Add destination (last location)
    const destination = tourOrder[tourOrder.length - 1];
    url += `&destination=${encodeURIComponent(destination.name)}`;
    
    // Add waypoints (locations in between)
    if (tourOrder.length > 2) {
      const waypoints = tourOrder.slice(1, -1).map(loc => encodeURIComponent(loc.name));
      url += `&waypoints=${waypoints.join('|')}`;
    }
    
    // Open in new tab
    window.open(url, '_blank');
    
    // Close dialog
    onClose();
  };

  const collegeLocations = locations.filter(loc => loc.type === 'college');

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Plan College Tour</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Select colleges to include in your tour:
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Button 
              size="small" 
              onClick={handleSelectAll}
              variant="outlined"
            >
              {selectedLocations.length === collegeLocations.length ? 'Deselect All' : 'Select All'}
            </Button>
          </Box>
          
          <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
            {collegeLocations.map((location) => (
              <ListItem 
                key={location.id}
                dense
                button
                onClick={() => handleToggleLocation(location.id)}
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selectedLocations.includes(location.id)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemIcon>
                  <SchoolIcon color="primary" />
                </ListItemIcon>
                <ListItemText 
                  primary={location.name}
                  secondary={location.metadata.address || 'No address available'}
                />
              </ListItem>
            ))}
            
            {collegeLocations.length === 0 && (
              <ListItem>
                <ListItemText primary="No college locations found" />
              </ListItem>
            )}
          </List>
        </Box>
        
        {selectedLocations.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Tour Options:
              </Typography>
              
              <FormControl component="fieldset">
                <RadioGroup
                  value={tourOption}
                  onChange={(e) => setTourOption(e.target.value as TourOption)}
                >
                  <FormControlLabel 
                    value="google-maps" 
                    control={<Radio />} 
                    label="Open in Google Maps (recommended)" 
                  />
                  <FormControlLabel 
                    value="in-app" 
                    control={<Radio />} 
                    label="Plan in-app (coming soon)" 
                    disabled
                  />
                </RadioGroup>
              </FormControl>
            </Box>
            
            {tourOption === 'google-maps' && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Tour Order:
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={optimizeRoute}
                        onChange={(e) => setOptimizeRoute(e.target.checked)}
                      />
                    }
                    label="Let Google Maps optimize route"
                  />
                  
                  <Tooltip title="Drag and drop to reorder">
                    <IconButton size="small" disabled={optimizeRoute}>
                      <SortIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {!optimizeRoute && (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="tour-locations">
                      {(provided: DroppableProvided) => (
                        <List
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          sx={{ 
                            maxHeight: 300, 
                            overflow: 'auto', 
                            border: '1px solid #eee', 
                            borderRadius: 1,
                            bgcolor: 'background.paper'
                          }}
                        >
                          {tourOrder.map((location, index) => (
                            <Draggable key={location.id} draggableId={location.id} index={index}>
                              {(provided: DraggableProvided) => (
                                <ListItem
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  sx={{ 
                                    borderBottom: '1px solid #f0f0f0',
                                    '&:last-child': { borderBottom: 'none' }
                                  }}
                                >
                                  <ListItemIcon>
                                    <Box sx={{ 
                                      width: 24, 
                                      height: 24, 
                                      borderRadius: '50%', 
                                      bgcolor: 'primary.main',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold'
                                    }}>
                                      {index + 1}
                                    </Box>
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={location.name}
                                    secondary={location.metadata.address || 'No address available'}
                                  />
                                </ListItem>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </List>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
                
                {optimizeRoute && tourOrder.length > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Google Maps will optimize your route for the most efficient travel between {tourOrder.length} locations.
                  </Alert>
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleOpenInGoogleMaps}
          variant="contained" 
          color="primary"
          startIcon={<DirectionsIcon />}
          disabled={selectedLocations.length === 0 || tourOption !== 'google-maps'}
        >
          Open in Google Maps
        </Button>
      </DialogActions>
    </Dialog>
  );
};
