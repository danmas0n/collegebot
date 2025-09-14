import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { StudentProfile } from '../../types/wizard';

interface AwardsAndRecognitionProps {
  data: StudentProfile;
  onUpdate: (field: keyof StudentProfile, value: any) => void;
}

export const AwardsAndRecognition: React.FC<AwardsAndRecognitionProps> = ({ data, onUpdate }) => {
  const addAward = (type: 'academic' | 'extracurricular') => {
    const awards = data.awards || {};
    const currentAwards = awards[type] || [];
    const newAward = type === 'academic' 
      ? { name: '', level: 'school' as const, year: new Date().getFullYear(), description: '' }
      : { name: '', organization: '', level: 'local' as const, year: new Date().getFullYear(), description: '' };
    
    onUpdate('awards', {
      ...awards,
      [type]: [...currentAwards, newAward]
    });
  };

  const updateAward = (type: 'academic' | 'extracurricular', index: number, field: string, value: any) => {
    const awards = data.awards || {};
    const currentAwards = [...(awards[type] || [])];
    currentAwards[index] = { ...currentAwards[index], [field]: value };
    
    onUpdate('awards', {
      ...awards,
      [type]: currentAwards
    });
  };

  const deleteAward = (type: 'academic' | 'extracurricular', index: number) => {
    const awards = data.awards || {};
    const currentAwards = awards[type] || [];
    
    onUpdate('awards', {
      ...awards,
      [type]: currentAwards.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Academic Awards</Typography>
          <Button startIcon={<AddIcon />} onClick={() => addAward('academic')}>
            Add Academic Award
          </Button>
        </Box>
        {data.awards?.academic?.map((award, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Award Name"
                    value={award.name}
                    onChange={e => updateAward('academic', index, 'name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Level</InputLabel>
                    <Select
                      value={award.level}
                      onChange={e => updateAward('academic', index, 'level', e.target.value)}
                    >
                      <MenuItem value="school">School</MenuItem>
                      <MenuItem value="district">District</MenuItem>
                      <MenuItem value="state">State</MenuItem>
                      <MenuItem value="national">National</MenuItem>
                      <MenuItem value="international">International</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Year"
                    type="number"
                    value={award.year}
                    onChange={e => updateAward('academic', index, 'year', parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={award.description || ''}
                    onChange={e => updateAward('academic', index, 'description', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteAward('academic', index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Extracurricular Awards</Typography>
          <Button startIcon={<AddIcon />} onClick={() => addAward('extracurricular')}>
            Add Extracurricular Award
          </Button>
        </Box>
        {data.awards?.extracurricular?.map((award, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Award Name"
                    value={award.name}
                    onChange={e => updateAward('extracurricular', index, 'name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Organization"
                    value={award.organization}
                    onChange={e => updateAward('extracurricular', index, 'organization', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth>
                    <InputLabel>Level</InputLabel>
                    <Select
                      value={award.level}
                      onChange={e => updateAward('extracurricular', index, 'level', e.target.value)}
                    >
                      <MenuItem value="local">Local</MenuItem>
                      <MenuItem value="regional">Regional</MenuItem>
                      <MenuItem value="state">State</MenuItem>
                      <MenuItem value="national">National</MenuItem>
                      <MenuItem value="international">International</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    label="Year"
                    type="number"
                    value={award.year}
                    onChange={e => updateAward('extracurricular', index, 'year', parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={award.description || ''}
                    onChange={e => updateAward('extracurricular', index, 'description', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteAward('extracurricular', index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>
    </>
  );
};
