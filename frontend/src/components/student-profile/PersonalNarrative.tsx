import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  Divider,
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

interface PersonalNarrativeProps {
  data: StudentProfile;
  onUpdate: (field: keyof StudentProfile, value: any) => void;
}

export const PersonalNarrative: React.FC<PersonalNarrativeProps> = ({ data, onUpdate }) => {
  const addEssayAngle = () => {
    const personalNarrative = data.personalNarrative || {};
    const essayAngles = personalNarrative.essayAngles || [];
    const newAngle = {
      theme: '',
      personalStory: '',
      strengths: [],
      examples: [],
      notes: ''
    };
    onUpdate('personalNarrative', {
      ...personalNarrative,
      essayAngles: [...essayAngles, newAngle]
    });
  };

  const updateEssayAngle = (index: number, field: string, value: any) => {
    const personalNarrative = data.personalNarrative || {};
    const essayAngles = [...(personalNarrative.essayAngles || [])];
    essayAngles[index] = { ...essayAngles[index], [field]: value };
    onUpdate('personalNarrative', {
      ...personalNarrative,
      essayAngles
    });
  };

  const deleteEssayAngle = (index: number) => {
    const personalNarrative = data.personalNarrative || {};
    const essayAngles = personalNarrative.essayAngles || [];
    onUpdate('personalNarrative', {
      ...personalNarrative,
      essayAngles: essayAngles.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <Typography color="text.secondary" paragraph>
        Help us understand your unique story and the themes you want to highlight in your applications.
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Essay Angles & Themes</Typography>
          <Button startIcon={<AddIcon />} onClick={addEssayAngle}>
            Add Essay Angle
          </Button>
        </Box>
        {data.personalNarrative?.essayAngles?.map((angle, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Theme/Topic"
                    value={angle.theme}
                    onChange={e => updateEssayAngle(index, 'theme', e.target.value)}
                    placeholder="e.g., Overcoming adversity, Leadership through service, Cultural identity"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Personal Story"
                    multiline
                    rows={3}
                    value={angle.personalStory}
                    onChange={e => updateEssayAngle(index, 'personalStory', e.target.value)}
                    placeholder="Describe the personal experience or story that illustrates this theme"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={2}
                    value={angle.notes || ''}
                    onChange={e => updateEssayAngle(index, 'notes', e.target.value)}
                    placeholder="Additional thoughts, potential colleges this might appeal to, etc."
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteEssayAngle(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Core Values
        </Typography>
        <TextField
          fullWidth
          label="What values are most important to you?"
          multiline
          rows={2}
          value={data.personalNarrative?.coreValues?.join(', ') || ''}
          onChange={e => {
            const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
            const personalNarrative = data.personalNarrative || {};
            onUpdate('personalNarrative', {
              ...personalNarrative,
              coreValues: values
            });
          }}
          placeholder="e.g., integrity, creativity, social justice, innovation"
          helperText="Separate multiple values with commas"
        />
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Unique Perspective
        </Typography>
        <TextField
          fullWidth
          label="What unique perspective do you bring?"
          multiline
          rows={3}
          value={data.personalNarrative?.uniquePerspective || ''}
          onChange={e => {
            const personalNarrative = data.personalNarrative || {};
            onUpdate('personalNarrative', {
              ...personalNarrative,
              uniquePerspective: e.target.value
            });
          }}
          placeholder="What makes your viewpoint or background distinctive? How do you see the world differently?"
        />
      </Box>
    </>
  );
};
