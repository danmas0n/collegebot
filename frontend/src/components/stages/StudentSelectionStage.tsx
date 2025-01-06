import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useWizard } from '../../contexts/WizardContext';
import { Student } from '../../types/wizard';

export const StudentSelectionStage: React.FC = () => {
  const { students, selectStudent, createStudent, deleteStudent } = useWizard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

  const handleCreateStudent = async () => {
    if (newStudentName.trim()) {
      try {
        await createStudent(newStudentName.trim());
        setNewStudentName('');
        setIsDialogOpen(false);
      } catch (error) {
        console.error('Failed to create student:', error);
        // Keep the dialog open and show error state
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Select or Create a Student Profile
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setIsDialogOpen(true)}
        >
          New Student
        </Button>
      </Box>

      <Typography color="text.secondary" paragraph>
        Choose an existing student profile or create a new one to get started.
      </Typography>

      {students.length > 0 ? (
        <List>
          {students.map((student: Student) => (
            <React.Fragment key={student.id}>
              <ListItem
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => deleteStudent(student.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <Box
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    py: 1
                  }}
                  onClick={() => selectStudent(student)}
                >
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    {student.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {formatDate(student.lastUpdated)}
                  </Typography>
                </Box>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      ) : (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            bgcolor: 'action.hover',
            borderRadius: 2
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            No student profiles yet
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setIsDialogOpen(true)}
          >
            Create Your First Profile
          </Button>
        </Box>
      )}

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <DialogTitle>Create New Student Profile</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Student Name"
            fullWidth
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateStudent()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateStudent}
            variant="contained"
            disabled={!newStudentName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
