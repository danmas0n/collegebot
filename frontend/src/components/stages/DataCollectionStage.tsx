import React, { useEffect, useState } from 'react';
import { useWizard } from '../../contexts/WizardContext';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
interface DataSource {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message?: string;
}

export const DataCollectionStage: React.FC = () => {
  const { updateData } = useWizard();
  const [dataSources, setDataSources] = useState<DataSource[]>([
    {
      id: 'cds',
      name: 'Common Data Sets',
      status: 'pending'
    },
    {
      id: 'reviews',
      name: 'College Reviews',
      status: 'pending'
    },
    {
      id: 'scholarships',
      name: 'Scholarship Opportunities',
      status: 'pending'
    }
  ]);

  const calculateProgress = () => {
    const completed = dataSources.filter(s => s.status === 'complete').length;
    return (completed / dataSources.length) * 100;
  };

  useEffect(() => {
    const processDataSources = async () => {
      // Start CDS collection
      setDataSources(prev => prev.map(s => 
        s.id === 'cds' ? { ...s, status: 'in-progress' } : s
      ));

      try {
        // Simulate CDS collection
        await new Promise(resolve => setTimeout(resolve, 2000));
        setDataSources(prev => prev.map(s => 
          s.id === 'cds' ? { ...s, status: 'complete' } : s
        ));

        // Start reviews collection
        setDataSources(prev => prev.map(s => 
          s.id === 'reviews' ? { ...s, status: 'in-progress' } : s
        ));

        // Simulate reviews collection
        await new Promise(resolve => setTimeout(resolve, 1500));
        setDataSources(prev => prev.map(s => 
          s.id === 'reviews' ? { ...s, status: 'complete' } : s
        ));

        // Start scholarships search
        setDataSources(prev => prev.map(s => 
          s.id === 'scholarships' ? { ...s, status: 'in-progress' } : s
        ));

        // Simulate scholarships search
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDataSources(prev => prev.map(s => 
          s.id === 'scholarships' ? { ...s, status: 'complete' } : s
        ));

        // Update wizard data with completion status
        updateData({
          dataCollection: {
            status: 'complete',
            sources: dataSources
          }
        });
      } catch (error) {
        console.error('Error collecting data:', error);
        setDataSources(prev => prev.map(s => 
          s.status === 'in-progress' 
            ? { ...s, status: 'error', message: 'Failed to collect data' }
            : s
        ));
      }
    };

    processDataSources();
  }, []);

  const getStatusIcon = (status: DataSource['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'in-progress':
        return <PendingIcon color="primary" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Collecting Data
      </Typography>
      <Typography color="text.secondary" paragraph>
        We're gathering information to help make personalized recommendations.
      </Typography>

      <Box sx={{ mb: 4 }}>
        <LinearProgress 
          variant="determinate" 
          value={calculateProgress()} 
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" color="text.secondary" align="right" sx={{ mt: 1 }}>
          {Math.round(calculateProgress())}% Complete
        </Typography>
      </Box>

      <List>
        {dataSources.map(source => (
          <ListItem key={source.id}>
            <ListItemIcon>
              {getStatusIcon(source.status)}
            </ListItemIcon>
            <ListItemText 
              primary={source.name}
              secondary={source.status === 'in-progress' ? 'Collecting data...' : undefined}
            />
          </ListItem>
        ))}
      </List>

      {dataSources.some(s => s.status === 'error') && (
        <Alert severity="error" sx={{ mt: 2 }}>
          There was an error collecting some data. You can still proceed, but recommendations may be limited.
        </Alert>
      )}
    </Paper>
  );
};
