import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import SchoolIcon from '@mui/icons-material/School';
import PaidIcon from '@mui/icons-material/Paid';
import { ResearchTask } from '../types/research';

interface ResearchStatusPanelProps {
  tasks: ResearchTask[];
  onShowDetails: (taskId: string) => void;
}

const getStatusColor = (status: ResearchTask['status']): string => {
  switch (status) {
    case 'queued':
      return '#9e9e9e';  // grey
    case 'in-progress':
      return '#2196f3';  // blue
    case 'complete':
      return '#4caf50';  // green
    default:
      return '#9e9e9e';
  }
};

const getStatusLabel = (status: ResearchTask['status']): string => {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'in-progress':
      return 'In Progress';
    case 'complete':
      return 'Complete';
    default:
      return status;
  }
};

export const ResearchStatusPanel: React.FC<ResearchStatusPanelProps> = ({
  tasks,
  onShowDetails,
}) => {
  if (tasks.length === 0) {
    return null;
  }

  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'complete');
  const queuedTasks = tasks.filter(task => task.status === 'queued');

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Research Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({completedTasks.length}/{tasks.length} complete)
          </Typography>
        </Box>

        {inProgressTasks.map(task => (
          <Box key={task.id} sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {task.entityType === 'college' ? (
                <SchoolIcon fontSize="small" />
              ) : (
                <PaidIcon fontSize="small" />
              )}
              <Typography variant="body2" noWrap>
                {task.entityName}
              </Typography>
              <Chip
                label={getStatusLabel(task.status)}
                size="small"
                sx={{
                  bgcolor: getStatusColor(task.status),
                  color: 'white',
                  height: '20px',
                }}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="View Details">
                <IconButton
                  size="small"
                  onClick={() => onShowDetails(task.id)}
                  sx={{ ml: 1 }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <LinearProgress
              variant="determinate"
              value={task.progress}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getStatusColor(task.status),
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {task.currentOperation}
            </Typography>
          </Box>
        ))}

        {queuedTasks.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Queued Tasks ({queuedTasks.length})
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {queuedTasks.map(task => (
                <Chip
                  key={task.id}
                  label={task.entityName}
                  size="small"
                  icon={task.entityType === 'college' ? <SchoolIcon /> : <PaidIcon />}
                  onClick={() => onShowDetails(task.id)}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {completedTasks.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Completed Research ({completedTasks.length})
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {completedTasks.map(task => (
                <Chip
                  key={task.id}
                  label={task.entityName}
                  size="small"
                  icon={task.entityType === 'college' ? <SchoolIcon /> : <PaidIcon />}
                  onClick={() => onShowDetails(task.id)}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
