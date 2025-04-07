import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Checkbox, 
  Button, 
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  Alert
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SchoolIcon from '@mui/icons-material/School';
import { useWizard } from '../../contexts/WizardContext';
import { MapLocation } from '../../types/wizard';
import { api } from '../../utils/api';

interface PinSelectorProps {
  onStartResearch: (pinIds: string[]) => Promise<void>;
}

const PinSelector: React.FC<PinSelectorProps> = ({ onStartResearch }) => {
  const { currentStudent, data } = useWizard();
  
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'type'>('name');
  
  // Load map locations
  useEffect(() => {
    const loadLocations = async () => {
      if (!currentStudent?.id) {
        setLocations([]);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Use the locations from the wizard context if available
        if (data.map?.locations && data.map.locations.length > 0) {
          setLocations(data.map.locations);
        } else {
          // Otherwise fetch from API
          const response = await api.post('/api/students/map-locations/get', {
            studentId: currentStudent.id
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `Failed to load locations: ${response.status}`);
          }
          
          const data = await response.json();
          setLocations(data);
        }
      } catch (err) {
        console.error('Error loading locations:', err);
        setError('Failed to load locations: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLocations();
  }, [currentStudent?.id, data.map?.locations]);
  
  // Handle sort change
  const handleSortChange = (event: SelectChangeEvent<'name' | 'type'>) => {
    setSortBy(event.target.value as 'name' | 'type');
  };
  
  // Handle pin selection
  const handleTogglePin = (pinId: string) => {
    setSelectedPins(prev => {
      if (prev.includes(pinId)) {
        return prev.filter(id => id !== pinId);
      } else {
        return [...prev, pinId];
      }
    });
  };
  
  // Handle select all
  const handleSelectAll = () => {
    if (selectedPins.length === locations.length) {
      setSelectedPins([]);
    } else {
      setSelectedPins(locations.map(location => location.id));
    }
  };
  
  // Handle start research
  const handleStartResearch = async () => {
    if (selectedPins.length === 0) {
      setError('Please select at least one pin');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await onStartResearch(selectedPins);
      
      // Clear selection after successful research start
      setSelectedPins([]);
    } catch (err) {
      console.error('Error starting research:', err);
      setError('Failed to start research: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sort locations
  const sortedLocations = [...locations].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      return a.type.localeCompare(b.type);
    }
  });
  
  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Select Pins for Research
      </Typography>
      
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="sort-by-label">Sort By</InputLabel>
          <Select
            labelId="sort-by-label"
            value={sortBy}
            label="Sort By"
            onChange={handleSortChange}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="type">Type</MenuItem>
          </Select>
        </FormControl>
        
        <Button 
          variant="outlined" 
          onClick={handleSelectAll}
          disabled={isLoading || locations.length === 0}
        >
          {selectedPins.length === locations.length ? 'Deselect All' : 'Select All'}
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : locations.length === 0 ? (
        <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
          No pins available. Add pins on the Map tab first.
        </Typography>
      ) : (
        <List sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
          {sortedLocations.map((location) => (
            <ListItem
              key={location.id}
              dense
              button
              onClick={() => handleTogglePin(location.id)}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedPins.includes(location.id)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemIcon>
                {location.type === 'college' ? (
                  <SchoolIcon color="primary" />
                ) : (
                  <LocationOnIcon color="secondary" />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={location.name}
                secondary={location.type.charAt(0).toUpperCase() + location.type.slice(1)}
              />
            </ListItem>
          ))}
        </List>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleStartResearch}
          disabled={isLoading || selectedPins.length === 0}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Start Research'}
        </Button>
      </Box>
    </Paper>
  );
};

export default PinSelector;
