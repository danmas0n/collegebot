import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  Autocomplete
} from '@mui/material';
import { useWizard } from '../../contexts/WizardContext';
import { CollegeInterests } from '../../types/wizard';

// Common majors list for autocomplete
const COMMON_MAJORS = [
  'Computer Science',
  'Business Administration',
  'Engineering',
  'Biology',
  'Psychology',
  'Economics',
  'English',
  'History',
  'Mathematics',
  'Political Science',
  'Chemistry',
  'Physics',
  'Sociology',
  'Art',
  'Music',
  'Education',
  'Nursing',
  'Communications',
  'Environmental Science',
  'Architecture'
];

// Fields of study categories
const FIELDS_OF_STUDY = [
  'Arts & Humanities',
  'Business',
  'Engineering & Technology',
  'Life Sciences',
  'Physical Sciences',
  'Social Sciences',
  'Health Sciences',
  'Education',
  'Environmental Studies',
  'Computer & Information Sciences'
];

export const CollegeInterestsStage: React.FC = () => {
  const { data, updateData } = useWizard();
  const [newCollege, setNewCollege] = useState('');

  const handleInterestsUpdate = (field: keyof CollegeInterests, value: any) => {
    updateData({
      collegeInterests: {
        ...data.collegeInterests,
        [field]: value
      }
    });
  };

  const handleAddCollege = () => {
    if (newCollege.trim()) {
      const colleges = data.collegeInterests.colleges || [];
      handleInterestsUpdate('colleges', [...colleges, newCollege.trim()]);
      setNewCollege('');
    }
  };

  const handleDeleteCollege = (college: string) => {
    const colleges = data.collegeInterests.colleges || [];
    handleInterestsUpdate(
      'colleges',
      colleges.filter(c => c !== college)
    );
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        College & Academic Interests
      </Typography>
      <Typography color="text.secondary" paragraph>
        Tell us about the colleges you're interested in and what you might want to study.
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Colleges of Interest
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="Add a college"
            value={newCollege}
            onChange={e => setNewCollege(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddCollege()}
            helperText="Enter any college you're thinking about or interested in"
          />
          <Button variant="contained" onClick={handleAddCollege}>
            Add
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.collegeInterests.colleges?.map(college => (
            <Chip
              key={college}
              label={college}
              onDelete={() => handleDeleteCollege(college)}
            />
          ))}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={COMMON_MAJORS}
            freeSolo
            value={data.collegeInterests.majors || []}
            onChange={(_, newValue) => handleInterestsUpdate('majors', newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Potential Majors"
                helperText="Select from common majors or type your own"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} {...getTagProps({ index })} />
              ))
            }
          />
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={FIELDS_OF_STUDY}
            value={data.collegeInterests.fieldsOfStudy || []}
            onChange={(_, newValue) => handleInterestsUpdate('fieldsOfStudy', newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Fields of Study"
                helperText="Select broader areas that interest you"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} {...getTagProps({ index })} />
              ))
            }
          />
        </Grid>
      </Grid>
    </Paper>
  );
};
