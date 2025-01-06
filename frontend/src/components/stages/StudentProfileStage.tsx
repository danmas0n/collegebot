import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  InputAdornment
} from '@mui/material';
import { useWizard } from '../../contexts/WizardContext';
import { StudentProfile } from '../../types/wizard';

export const StudentProfileStage: React.FC = () => {
  const { data, updateData } = useWizard();
  const [newActivity, setNewActivity] = useState('');
  const [newSport, setNewSport] = useState('');

  const handleProfileUpdate = (field: keyof StudentProfile, value: any) => {
    updateData({
      studentProfile: {
        ...data.studentProfile,
        [field]: value
      }
    });
  };

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      const activities = data.studentProfile.extracurriculars || [];
      handleProfileUpdate('extracurriculars', [...activities, newActivity.trim()]);
      setNewActivity('');
    }
  };

  const handleAddSport = () => {
    if (newSport.trim()) {
      const sports = data.studentProfile.sports || [];
      handleProfileUpdate('sports', [...sports, newSport.trim()]);
      setNewSport('');
    }
  };

  const handleDeleteActivity = (activity: string) => {
    const activities = data.studentProfile.extracurriculars || [];
    handleProfileUpdate(
      'extracurriculars',
      activities.filter(a => a !== activity)
    );
  };

  const handleDeleteSport = (sport: string) => {
    const sports = data.studentProfile.sports || [];
    handleProfileUpdate(
      'sports',
      sports.filter(s => s !== sport)
    );
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Tell us about yourself
      </Typography>
      <Typography color="text.secondary" paragraph>
        This information helps us find colleges and scholarships that match your profile.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={8}>
          <TextField
            fullWidth
            label="High School"
            value={data.studentProfile.highSchool || ''}
            onChange={e => handleProfileUpdate('highSchool', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="High School ZIP"
            value={data.studentProfile.highSchoolZip || ''}
            onChange={e => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 5);
              handleProfileUpdate('highSchoolZip', value);
            }}
            inputProps={{ 
              maxLength: 5,
              pattern: '[0-9]*'
            }}
            helperText={data.studentProfile.highSchoolZip?.length === 5 ? '' : 'Enter a 5-digit ZIP code'}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Graduation Year"
            type="number"
            value={data.studentProfile.graduationYear || ''}
            onChange={e => handleProfileUpdate('graduationYear', parseInt(e.target.value) || undefined)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="GPA"
            type="number"
            inputProps={{ step: 0.01, min: 0, max: 4.0 }}
            value={data.studentProfile.gpa || ''}
            onChange={e => handleProfileUpdate('gpa', parseFloat(e.target.value) || undefined)}
            InputProps={{
              endAdornment: <InputAdornment position="end">/4.0</InputAdornment>
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="SAT Score"
            type="number"
            inputProps={{ step: 10, min: 400, max: 1600 }}
            value={data.studentProfile.satScore || ''}
            onChange={e => handleProfileUpdate('satScore', parseInt(e.target.value) || undefined)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="ACT Score"
            type="number"
            inputProps={{ step: 1, min: 1, max: 36 }}
            value={data.studentProfile.actScore || ''}
            onChange={e => handleProfileUpdate('actScore', parseInt(e.target.value) || undefined)}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
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
          {data.studentProfile.extracurriculars?.map(activity => (
            <Chip
              key={activity}
              label={activity}
              onDelete={() => handleDeleteActivity(activity)}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
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
          {data.studentProfile.sports?.map(sport => (
            <Chip
              key={sport}
              label={sport}
              onDelete={() => handleDeleteSport(sport)}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  );
};
