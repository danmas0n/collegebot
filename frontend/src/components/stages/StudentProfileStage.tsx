import React from 'react';
import {
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useWizard } from '../../contexts/WizardContext';
import { StudentProfile } from '../../types/wizard';
import {
  BasicInformation,
  ActivitiesAndSports,
  AwardsAndRecognition,
  ExperienceAndWork,
  PersonalNarrative
} from '../student-profile';

export const StudentProfileStage: React.FC = () => {
  const { data, updateData } = useWizard();

  const handleProfileUpdate = (field: keyof StudentProfile, value: any) => {
    updateData({
      studentProfile: {
        ...data.studentProfile,
        [field]: value
      }
    });
  };

  return (
    <Paper data-testid="student-profile-stage" elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Tell us about yourself
      </Typography>
      <Typography color="text.secondary" paragraph>
        This comprehensive profile helps us find colleges and scholarships that match your unique story and achievements.
      </Typography>

      <Box sx={{ 
        '& .MuiAccordion-root': { 
          borderBottom: '1px solid', 
          borderColor: 'divider',
          '&:before': {
            display: 'none'
          }
        } 
      }}>
        {/* Basic Information */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Basic Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <BasicInformation 
              data={data.studentProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </AccordionDetails>
        </Accordion>

        {/* Activities & Sports */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Activities & Sports</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ActivitiesAndSports 
              data={data.studentProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </AccordionDetails>
        </Accordion>

        {/* Awards & Recognition */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Awards & Recognition</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <AwardsAndRecognition 
              data={data.studentProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </AccordionDetails>
        </Accordion>

        {/* Experience & Work */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Experience & Work</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ExperienceAndWork 
              data={data.studentProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </AccordionDetails>
        </Accordion>

        {/* Personal Narrative & Essay Angles */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Personal Narrative & Essay Angles</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <PersonalNarrative 
              data={data.studentProfile} 
              onUpdate={handleProfileUpdate} 
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Paper>
  );
};
