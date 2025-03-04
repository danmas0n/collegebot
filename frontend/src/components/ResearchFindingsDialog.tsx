import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import PaidIcon from '@mui/icons-material/Paid';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InfoIcon from '@mui/icons-material/Info';
import { ResearchTask, ResearchFinding } from '../types/research';

interface ResearchFindingsDialogProps {
  task: ResearchTask | null;
  onClose: () => void;
}

const getCategoryIcon = (category: ResearchFinding['category']) => {
  switch (category) {
    case 'deadline':
      return <CalendarTodayIcon fontSize="small" />;
    case 'requirement':
      return <AssignmentIcon fontSize="small" />;
    case 'contact':
      return <ContactMailIcon fontSize="small" />;
    case 'financial':
      return <AttachMoneyIcon fontSize="small" />;
    default:
      return <InfoIcon fontSize="small" />;
  }
};

const getCategoryLabel = (category: ResearchFinding['category']): string => {
  switch (category) {
    case 'deadline':
      return 'Deadline';
    case 'requirement':
      return 'Requirement';
    case 'contact':
      return 'Contact';
    case 'financial':
      return 'Financial';
    default:
      return 'Other';
  }
};

const getConfidenceColor = (confidence: ResearchFinding['confidence']): string => {
  switch (confidence) {
    case 'high':
      return '#4caf50';  // green
    case 'medium':
      return '#ff9800';  // orange
    case 'low':
      return '#f44336';  // red
    default:
      return '#9e9e9e';  // grey
  }
};

export const ResearchFindingsDialog: React.FC<ResearchFindingsDialogProps> = ({
  task,
  onClose,
}) => {
  if (!task) return null;

  const findingsByCategory = task.findings.reduce((acc, finding) => {
    if (!acc[finding.category]) {
      acc[finding.category] = [];
    }
    acc[finding.category].push(finding);
    return acc;
  }, {} as Record<ResearchFinding['category'], ResearchFinding[]>);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: 'calc(100vh - 64px)',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {task.entityType === 'college' ? (
            <SchoolIcon color="primary" />
          ) : (
            <PaidIcon color="primary" />
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {task.entityName}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ ml: 2 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {Object.entries(findingsByCategory).map(([category, findings]) => (
            <Box key={category}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {getCategoryIcon(category as ResearchFinding['category'])}
                <Typography variant="subtitle1">
                  {getCategoryLabel(category as ResearchFinding['category'])}
                </Typography>
              </Box>

              <Stack spacing={2}>
                {findings.map((finding, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <Typography variant="body1" sx={{ flex: 1 }}>
                        {finding.detail}
                      </Typography>
                      <Chip
                        label={finding.confidence}
                        size="small"
                        sx={{
                          bgcolor: getConfidenceColor(finding.confidence),
                          color: 'white',
                          textTransform: 'capitalize',
                        }}
                      />
                    </Box>
                    {finding.source && (
                      <Typography variant="caption" color="text.secondary">
                        Source: {finding.source}
                      </Typography>
                    )}
                    {index < findings.length - 1 && (
                      <Divider sx={{ mt: 2 }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
