import React from 'react';
import {
  Grid,
  TextField,
  InputAdornment
} from '@mui/material';
import { StudentProfile } from '../../types/wizard';

interface BasicInformationProps {
  data: StudentProfile;
  onUpdate: (field: keyof StudentProfile, value: any) => void;
}

export const BasicInformation: React.FC<BasicInformationProps> = ({ data, onUpdate }) => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={8}>
        <TextField
          fullWidth
          label="High School"
          value={data.highSchool || ''}
          onChange={e => onUpdate('highSchool', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="High School ZIP"
          value={data.highSchoolZip || ''}
          onChange={e => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 5);
            onUpdate('highSchoolZip', value);
          }}
          inputProps={{ 
            maxLength: 5,
            pattern: '[0-9]*'
          }}
          helperText={data.highSchoolZip?.length === 5 ? '' : 'Enter a 5-digit ZIP code'}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Graduation Year"
          type="number"
          value={data.graduationYear || ''}
          onChange={e => onUpdate('graduationYear', parseInt(e.target.value) || undefined)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="GPA"
          type="number"
          inputProps={{ step: 0.01, min: 0, max: 4.0 }}
          value={data.gpa || ''}
          onChange={e => onUpdate('gpa', parseFloat(e.target.value) || undefined)}
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
          value={data.satScore || ''}
          onChange={e => onUpdate('satScore', parseInt(e.target.value) || undefined)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="ACT Score"
          type="number"
          inputProps={{ step: 1, min: 1, max: 36 }}
          value={data.actScore || ''}
          onChange={e => onUpdate('actScore', parseInt(e.target.value) || undefined)}
        />
      </Grid>
    </Grid>
  );
};
