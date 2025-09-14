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

interface ExperienceAndWorkProps {
  data: StudentProfile;
  onUpdate: (field: keyof StudentProfile, value: any) => void;
}

export const ExperienceAndWork: React.FC<ExperienceAndWorkProps> = ({ data, onUpdate }) => {
  // Publications handlers
  const addPublication = () => {
    const publications = data.publications || [];
    const newPublication = {
      title: '',
      type: 'other' as const,
      venue: '',
      date: '',
      url: '',
      description: '',
      role: 'author' as const
    };
    onUpdate('publications', [...publications, newPublication]);
  };

  const updatePublication = (index: number, field: string, value: any) => {
    const publications = [...(data.publications || [])];
    publications[index] = { ...publications[index], [field]: value };
    onUpdate('publications', publications);
  };

  const deletePublication = (index: number) => {
    const publications = data.publications || [];
    onUpdate('publications', publications.filter((_, i) => i !== index));
  };

  // Volunteer work handlers
  const addVolunteerWork = () => {
    const volunteerWork = data.volunteerWork || [];
    const newWork = {
      organization: '',
      role: '',
      startDate: '',
      endDate: '',
      hoursPerWeek: undefined,
      totalHours: undefined,
      description: '',
      impact: '',
      skills: []
    };
    onUpdate('volunteerWork', [...volunteerWork, newWork]);
  };

  const updateVolunteerWork = (index: number, field: string, value: any) => {
    const volunteerWork = [...(data.volunteerWork || [])];
    volunteerWork[index] = { ...volunteerWork[index], [field]: value };
    onUpdate('volunteerWork', volunteerWork);
  };

  const deleteVolunteerWork = (index: number) => {
    const volunteerWork = data.volunteerWork || [];
    onUpdate('volunteerWork', volunteerWork.filter((_, i) => i !== index));
  };

  // Leadership handlers
  const addLeadership = () => {
    const leadership = data.leadership || [];
    const newLeadership = {
      position: '',
      organization: '',
      startDate: '',
      endDate: '',
      description: '',
      achievements: [],
      teamSize: undefined
    };
    onUpdate('leadership', [...leadership, newLeadership]);
  };

  const updateLeadership = (index: number, field: string, value: any) => {
    const leadership = [...(data.leadership || [])];
    leadership[index] = { ...leadership[index], [field]: value };
    onUpdate('leadership', leadership);
  };

  const deleteLeadership = (index: number) => {
    const leadership = data.leadership || [];
    onUpdate('leadership', leadership.filter((_, i) => i !== index));
  };

  // Work experience handlers
  const addWorkExperience = () => {
    const workExperience = data.workExperience || [];
    const newWork = {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      hoursPerWeek: undefined,
      description: '',
      skills: [],
      supervisor: { name: '', email: '', phone: '' }
    };
    onUpdate('workExperience', [...workExperience, newWork]);
  };

  const updateWorkExperience = (index: number, field: string, value: any) => {
    const workExperience = [...(data.workExperience || [])];
    workExperience[index] = { ...workExperience[index], [field]: value };
    onUpdate('workExperience', workExperience);
  };

  const deleteWorkExperience = (index: number) => {
    const workExperience = data.workExperience || [];
    onUpdate('workExperience', workExperience.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Publications & Creative Works */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Publications & Creative Works</Typography>
          <Button startIcon={<AddIcon />} onClick={addPublication}>
            Add Publication
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Research papers, articles, creative writing, art, music, or other published/showcased works
        </Typography>
        {data.publications?.map((publication, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={publication.title}
                    onChange={e => updatePublication(index, 'title', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={publication.type}
                      onChange={e => updatePublication(index, 'type', e.target.value)}
                    >
                      <MenuItem value="research_paper">Research Paper</MenuItem>
                      <MenuItem value="article">Article</MenuItem>
                      <MenuItem value="creative_writing">Creative Writing</MenuItem>
                      <MenuItem value="art">Art</MenuItem>
                      <MenuItem value="music">Music</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={publication.role}
                      onChange={e => updatePublication(index, 'role', e.target.value)}
                    >
                      <MenuItem value="author">Author</MenuItem>
                      <MenuItem value="co-author">Co-Author</MenuItem>
                      <MenuItem value="contributor">Contributor</MenuItem>
                      <MenuItem value="creator">Creator</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Venue/Publication"
                    value={publication.venue || ''}
                    onChange={e => updatePublication(index, 'venue', e.target.value)}
                    placeholder="Journal, magazine, website, gallery, etc."
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Date"
                    type="date"
                    value={publication.date}
                    onChange={e => updatePublication(index, 'date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="URL"
                    value={publication.url || ''}
                    onChange={e => updatePublication(index, 'url', e.target.value)}
                    placeholder="Link to work"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={publication.description || ''}
                    onChange={e => updatePublication(index, 'description', e.target.value)}
                    placeholder="Brief description of the work and its significance"
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deletePublication(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {/* Volunteer Work & Community Service */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Volunteer Work & Community Service</Typography>
          <Button startIcon={<AddIcon />} onClick={addVolunteerWork}>
            Add Volunteer Work
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Community service, volunteer work, and social impact activities
        </Typography>
        {data.volunteerWork?.map((work, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Organization"
                    value={work.organization}
                    onChange={e => updateVolunteerWork(index, 'organization', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Role/Position"
                    value={work.role}
                    onChange={e => updateVolunteerWork(index, 'role', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={work.startDate}
                    onChange={e => updateVolunteerWork(index, 'startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={work.endDate || ''}
                    onChange={e => updateVolunteerWork(index, 'endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText="Leave blank if ongoing"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Hours/Week"
                    type="number"
                    value={work.hoursPerWeek || ''}
                    onChange={e => updateVolunteerWork(index, 'hoursPerWeek', parseInt(e.target.value) || undefined)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Total Hours"
                    type="number"
                    value={work.totalHours || ''}
                    onChange={e => updateVolunteerWork(index, 'totalHours', parseInt(e.target.value) || undefined)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={work.description}
                    onChange={e => updateVolunteerWork(index, 'description', e.target.value)}
                    placeholder="What did you do? What were your responsibilities?"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Impact"
                    multiline
                    rows={2}
                    value={work.impact || ''}
                    onChange={e => updateVolunteerWork(index, 'impact', e.target.value)}
                    placeholder="What impact did your work have? How did you make a difference?"
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteVolunteerWork(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {/* Leadership Experience */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Leadership Experience</Typography>
          <Button startIcon={<AddIcon />} onClick={addLeadership}>
            Add Leadership Role
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Leadership roles in school, community, or organizations
        </Typography>
        {data.leadership?.map((leadership, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Position/Title"
                    value={leadership.position}
                    onChange={e => updateLeadership(index, 'position', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Organization"
                    value={leadership.organization}
                    onChange={e => updateLeadership(index, 'organization', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={leadership.startDate}
                    onChange={e => updateLeadership(index, 'startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={leadership.endDate || ''}
                    onChange={e => updateLeadership(index, 'endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText="Leave blank if ongoing"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Team Size"
                    type="number"
                    value={leadership.teamSize || ''}
                    onChange={e => updateLeadership(index, 'teamSize', parseInt(e.target.value) || undefined)}
                    placeholder="People you led"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={leadership.description}
                    onChange={e => updateLeadership(index, 'description', e.target.value)}
                    placeholder="What were your responsibilities and leadership activities?"
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteLeadership(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>

      {/* Work Experience */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Work Experience</Typography>
          <Button startIcon={<AddIcon />} onClick={addWorkExperience}>
            Add Work Experience
          </Button>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Part-time jobs, internships, and professional experience
        </Typography>
        {data.workExperience?.map((work, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company/Organization"
                    value={work.company}
                    onChange={e => updateWorkExperience(index, 'company', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Position/Title"
                    value={work.position}
                    onChange={e => updateWorkExperience(index, 'position', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={work.startDate}
                    onChange={e => updateWorkExperience(index, 'startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={work.endDate || ''}
                    onChange={e => updateWorkExperience(index, 'endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    helperText="Leave blank if ongoing"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Hours/Week"
                    type="number"
                    value={work.hoursPerWeek || ''}
                    onChange={e => updateWorkExperience(index, 'hoursPerWeek', parseInt(e.target.value) || undefined)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={work.description}
                    onChange={e => updateWorkExperience(index, 'description', e.target.value)}
                    placeholder="What were your responsibilities and accomplishments?"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Supervisor Information (Optional)
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Supervisor Name"
                    value={work.supervisor?.name || ''}
                    onChange={e => updateWorkExperience(index, 'supervisor', {
                      ...work.supervisor,
                      name: e.target.value
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Supervisor Email"
                    value={work.supervisor?.email || ''}
                    onChange={e => updateWorkExperience(index, 'supervisor', {
                      ...work.supervisor,
                      email: e.target.value
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Supervisor Phone"
                    value={work.supervisor?.phone || ''}
                    onChange={e => updateWorkExperience(index, 'supervisor', {
                      ...work.supervisor,
                      phone: e.target.value
                    })}
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <IconButton onClick={() => deleteWorkExperience(index)} color="error">
                <DeleteIcon />
              </IconButton>
            </CardActions>
          </Card>
        ))}
      </Box>
    </>
  );
};
