import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Chip,
  Button
} from '@mui/material';
import { StudentProfile } from '../../types/wizard';

interface ActivitiesAndSportsProps {
  data: StudentProfile;
  onUpdate: (field: keyof StudentProfile, value: any) => void;
}

export const ActivitiesAndSports: React.FC<ActivitiesAndSportsProps> = ({ data, onUpdate }) => {
  const [newActivity, setNewActivity] = useState('');
  const [newSport, setNewSport] = useState('');

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      const activities = data.extracurriculars || [];
      onUpdate('extracurriculars', [...activities, newActivity.trim()]);
      setNewActivity('');
    }
  };

  const handleAddSport = () => {
    if (newSport.trim()) {
      const sports = data.sports || [];
      onUpdate('sports', [...sports, newSport.trim()]);
      setNewSport('');
    }
  };

  const handleDeleteActivity = (activity: string) => {
    const activities = data.extracurriculars || [];
    onUpdate('extracurriculars', activities.filter(a => a !== activity));
  };

  const handleDeleteSport = (sport: string) => {
    const sports = data.sports || [];
    onUpdate('sports', sports.filter(s => s !== sport));
  };

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Extracurricular Activities
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="Add an activity"
            value={newActivity}
            onChange={e => setNewActivity(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddActivity()}
          />
          <Button variant="contained" onClick={handleAddActivity}>
            Add
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.extracurriculars?.map(activity => (
            <Chip
              key={activity}
              label={activity}
              onDelete={() => handleDeleteActivity(activity)}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Sports
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="Add a sport"
            value={newSport}
            onChange={e => setNewSport(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddSport()}
          />
          <Button variant="contained" onClick={handleAddSport}>
            Add
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.sports?.map(sport => (
            <Chip
              key={sport}
              label={sport}
              onDelete={() => handleDeleteSport(sport)}
            />
          ))}
        </Box>
      </Box>
    </>
  );
};
