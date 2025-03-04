import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  IconButton,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import PaidIcon from '@mui/icons-material/Paid';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';

// Define a Task interface
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  category: 'application' | 'scholarship' | 'financial' | 'other';
  relatedEntities: {
    collegeIds: string[];
    scholarshipIds: string[];
  };
  studentId: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskListProps {
  findings: any[];
  studentId: string;
}

export const TaskList: React.FC<TaskListProps> = ({ findings, studentId }) => {
  const { showNotification } = useNotification();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    dueDate: '',
    completed: false,
    category: 'application',
    relatedEntities: {
      collegeIds: [],
      scholarshipIds: []
    }
  });

  // Load tasks when component mounts
  React.useEffect(() => {
    if (studentId) {
      loadTasks();
    }
  }, [studentId]);

  const loadTasks = async () => {
    try {
      // This is a placeholder - we'll need to implement the actual API endpoint
      const response = await api.get(`/api/tasks/${studentId}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      } else {
        // For now, just use mock data
        setTasks([
          {
            id: '1',
            title: 'Complete Stanford application',
            description: 'Fill out all sections of the application',
            dueDate: '2025-12-01',
            completed: false,
            category: 'application',
            relatedEntities: {
              collegeIds: ['stanford'],
              scholarshipIds: []
            },
            studentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: '2',
            title: 'Submit FAFSA',
            description: 'Complete and submit FAFSA application',
            dueDate: '2025-01-15',
            completed: false,
            category: 'financial',
            relatedEntities: {
              collegeIds: [],
              scholarshipIds: []
            },
            studentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ] as Task[]);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      showNotification('Failed to load tasks', 'error');
    }
  };

  const handleAddTask = async () => {
    try {
      // This is a placeholder - we'll need to implement the actual API endpoint
      const task: Task = {
        ...newTask as Task,
        id: `task-${Date.now()}`,
        studentId,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // In a real implementation, we would save to the backend
      // const response = await api.post('/api/tasks', { task });
      // if (response.ok) {
      //   const savedTask = await response.json();
      //   setTasks(prev => [...prev, savedTask]);
      // }

      // For now, just update the local state
      setTasks(prev => [...prev, task]);
      setIsAddDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        dueDate: '',
        completed: false,
        category: 'application',
        relatedEntities: {
          collegeIds: [],
          scholarshipIds: []
        }
      });
      showNotification('Task added successfully', 'success');
    } catch (error) {
      console.error('Error adding task:', error);
      showNotification('Failed to add task', 'error');
    }
  };

  const handleEditTask = async () => {
    if (!currentTask) return;

    try {
      // This is a placeholder - we'll need to implement the actual API endpoint
      // const response = await api.put(`/api/tasks/${currentTask.id}`, { task: currentTask });
      // if (response.ok) {
      //   const updatedTask = await response.json();
      //   setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task));
      // }

      // For now, just update the local state
      setTasks(prev => prev.map(task => task.id === currentTask.id ? {
        ...currentTask,
        updatedAt: new Date().toISOString()
      } : task));
      setIsEditDialogOpen(false);
      setCurrentTask(null);
      showNotification('Task updated successfully', 'success');
    } catch (error) {
      console.error('Error updating task:', error);
      showNotification('Failed to update task', 'error');
    }
  };

  const handleDeleteTask = async () => {
    if (!currentTask) return;

    try {
      // This is a placeholder - we'll need to implement the actual API endpoint
      // const response = await api.delete(`/api/tasks/${currentTask.id}`);
      // if (response.ok) {
      //   setTasks(prev => prev.filter(task => task.id !== currentTask.id));
      // }

      // For now, just update the local state
      setTasks(prev => prev.filter(task => task.id !== currentTask.id));
      setIsDeleteDialogOpen(false);
      setCurrentTask(null);
      showNotification('Task deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      showNotification('Failed to delete task', 'error');
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === taskId);
      if (!taskToUpdate) return;

      const updatedTask = {
        ...taskToUpdate,
        completed: !taskToUpdate.completed,
        updatedAt: new Date().toISOString()
      };

      // This is a placeholder - we'll need to implement the actual API endpoint
      // const response = await api.put(`/api/tasks/${taskId}`, { 
      //   task: { completed: !taskToUpdate.completed } 
      // });
      // if (response.ok) {
      //   const updatedTask = await response.json();
      //   setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task));
      // }

      // For now, just update the local state
      setTasks(prev => prev.map(task => task.id === taskId ? updatedTask : task));
      showNotification(`Task marked as ${updatedTask.completed ? 'completed' : 'incomplete'}`, 'success');
    } catch (error) {
      console.error('Error updating task:', error);
      showNotification('Failed to update task', 'error');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'application':
        return <AssignmentIcon />;
      case 'scholarship':
        return <PaidIcon />;
      case 'financial':
        return <AttachMoneyIcon />;
      default:
        return <AssignmentIcon />;
    }
  };

  // Create tasks from findings
  const handleCreateTasksFromFindings = () => {
    const newTasks: Task[] = findings
      .filter(finding => finding.category === 'deadline')
      .map(finding => ({
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: finding.detail,
        description: `Auto-generated from research finding for ${finding.entityName}`,
        dueDate: extractDate(finding.detail),
        completed: false,
        category: finding.entityType === 'college' ? 'application' : 'scholarship',
        relatedEntities: {
          collegeIds: finding.entityType === 'college' ? [finding.entityId] : [],
          scholarshipIds: finding.entityType === 'scholarship' ? [finding.entityId] : []
        },
        studentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

    if (newTasks.length > 0) {
      setTasks(prev => [...prev, ...newTasks]);
      showNotification(`Created ${newTasks.length} tasks from findings`, 'success');
    } else {
      showNotification('No deadline findings to create tasks from', 'info');
    }
  };

  // Helper function to extract date from a string
  const extractDate = (text: string): string => {
    const dateRegex = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi;
    const match = text.match(dateRegex);
    if (match) {
      try {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    return '';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tasks & Deadlines</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add Task
          </Button>
          {findings.length > 0 && (
            <Button
              variant="outlined"
              onClick={handleCreateTasksFromFindings}
            >
              Create from Findings
            </Button>
          )}
        </Box>
      </Box>

      {tasks.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No tasks yet. Add a task or create them from research findings.
          </Typography>
        </Paper>
      ) : (
        <List>
          {tasks.map((task) => (
            <Paper key={task.id} sx={{ mb: 2 }}>
              <ListItem
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() => {
                        setCurrentTask(task);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => {
                        setCurrentTask(task);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task.id)}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? 'text.secondary' : 'text.primary'
                        }}
                      >
                        {task.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={task.category}
                        icon={getCategoryIcon(task.category)}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      {task.description && (
                        <Typography variant="body2" color="text.secondary">
                          {task.description}
                        </Typography>
                      )}
                      {task.dueDate && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <CalendarTodayIcon fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            </Paper>
          ))}
        </List>
      )}

      {/* Add Task Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Task</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Title"
              fullWidth
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTask.category}
                label="Category"
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value as any })}
              >
                <MenuItem value="application">Application</MenuItem>
                <MenuItem value="scholarship">Scholarship</MenuItem>
                <MenuItem value="financial">Financial</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddTask}
            variant="contained"
            disabled={!newTask.title}
          >
            Add Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Task</DialogTitle>
        <DialogContent>
          {currentTask && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Title"
                fullWidth
                value={currentTask.title}
                onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                required
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={currentTask.description}
                onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
              />
              <TextField
                label="Due Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={currentTask.dueDate}
                onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
              />
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={currentTask.category}
                  label="Category"
                  onChange={(e) => setCurrentTask({ ...currentTask, category: e.target.value as any })}
                >
                  <MenuItem value="application">Application</MenuItem>
                  <MenuItem value="scholarship">Scholarship</MenuItem>
                  <MenuItem value="financial">Financial</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={currentTask.completed ? 'completed' : 'pending'}
                  label="Status"
                  onChange={(e) => setCurrentTask({ 
                    ...currentTask, 
                    completed: e.target.value === 'completed' 
                  })}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditTask}
            variant="contained"
            disabled={!currentTask?.title}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this task?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTask} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Missing icon definition
const AttachMoneyIcon = () => <PaidIcon />;
