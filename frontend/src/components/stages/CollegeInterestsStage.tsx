import React, { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox
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

// US Regions
const REGIONS = [
  'Northeast',
  'Mid-Atlantic',
  'Southeast',
  'Midwest',
  'Southwest',
  'West Coast',
  'Northwest',
  'Hawaii/Alaska'
];

// US States
const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

// Urban Settings
const URBAN_SETTINGS = [
  { value: 'urban', label: 'Urban' },
  { value: 'suburban', label: 'Suburban' },
  { value: 'rural', label: 'Rural' }
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

  const handleLocationPreferencesUpdate = (field: keyof NonNullable<CollegeInterests['locationPreferences']>, value: any) => {
    const currentPreferences = data.collegeInterests.locationPreferences || {};
    updateData({
      collegeInterests: {
        ...data.collegeInterests,
        locationPreferences: {
          ...currentPreferences,
          [field]: value
        }
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
    <Paper data-testid="college-interests-stage" elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        College & Academic Interests
      </Typography>
      <Typography color="text.secondary" paragraph>
        Tell us about the colleges you're interested in, what you might want to study, and your location preferences.
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

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Location Preferences
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              options={REGIONS}
              value={data.collegeInterests.locationPreferences?.regions || []}
              onChange={(_, newValue) => handleLocationPreferencesUpdate('regions', newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Preferred Regions"
                  helperText="Select regions you're interested in"
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
              options={STATES}
              value={data.collegeInterests.locationPreferences?.states || []}
              onChange={(_, newValue) => handleLocationPreferencesUpdate('states', newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Preferred States"
                  helperText="Select specific states you're interested in"
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
            <Typography gutterBottom>
              Distance from Home (miles)
            </Typography>
            <Box sx={{ px: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Minimum Distance"
                    value={data.collegeInterests.locationPreferences?.minDistanceFromHome || ''}
                    onChange={(e) => handleLocationPreferencesUpdate('minDistanceFromHome', parseInt(e.target.value) || undefined)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Maximum Distance"
                    value={data.collegeInterests.locationPreferences?.maxDistanceFromHome || ''}
                    onChange={(e) => handleLocationPreferencesUpdate('maxDistanceFromHome', parseInt(e.target.value) || undefined)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography gutterBottom>
                Campus Setting
              </Typography>
              <FormGroup row>
                {URBAN_SETTINGS.map(setting => (
                  <FormControlLabel
                    key={setting.value}
                    control={
                      <Checkbox
                        checked={data.collegeInterests.locationPreferences?.urbanSettings?.includes(setting.value as any) || false}
                        onChange={(e) => {
                          const currentSettings = data.collegeInterests.locationPreferences?.urbanSettings || [];
                          if (e.target.checked) {
                            handleLocationPreferencesUpdate('urbanSettings', [...currentSettings, setting.value]);
                          } else {
                            handleLocationPreferencesUpdate(
                              'urbanSettings',
                              currentSettings.filter(s => s !== setting.value)
                            );
                          }
                        }}
                      />
                    }
                    label={setting.label}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};
