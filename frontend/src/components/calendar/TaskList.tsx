import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { isSameDay } from 'date-fns';
import { useCalendar } from '../../contexts/CalendarContext';
import { useWizard } from '../../contexts/WizardContext';

interface TaskFormData {
  title: string;
  description: string;
  dueDate: Date | null;
  category: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

interface TaskListProps {
  filterDate?: Date;
  filterSchool?: string;
  filterPlan?: string;
}

const TaskList: React.FC<TaskListProps> = ({ filterDate, filterSchool, filterPlan }) => {
  const { currentStudent } = useWizard();
  const { tasks, calendarItems, isLoading, error, createTask, updateTask, deleteTask } = useCalendar();
  
  // State for filtering and sorting
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'category'>('dueDate');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // State for task form
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    dueDate: null,
    category: 'application',
    priority: 'medium',
    tags: []
  });
  const [formError, setFormError] = useState<string | null>(null);
  
  // Handle filter change
  const handleFilterChange = (event: SelectChangeEvent<'all' | 'completed' | 'incomplete'>) => {
    setFilter(event.target.value as 'all' | 'completed' | 'incomplete');
  };
  
  // Handle sort change
  const handleSortChange = (event: SelectChangeEvent<'dueDate' | 'priority' | 'category'>) => {
    setSortBy(event.target.value as 'dueDate' | 'priority' | 'category');
  };
  
  // Handle search change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  // Handle task completion toggle
  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await updateTask(taskId, { completed: !completed });
    } catch (err) {
      console.error('Error toggling task completion:', err);
    }
  };
  
  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  };
  
  // Handle opening the form for creating a new task
  const handleOpenNewTaskForm = () => {
    setFormData({
      title: '',
      description: '',
      dueDate: null,
      category: 'application',
      priority: 'medium',
      tags: []
    });
    setIsEditMode(false);
    setEditingTaskId(null);
    setFormError(null);
    setIsFormOpen(true);
  };
  
  // Handle opening the form for editing a task
  const handleOpenEditTaskForm = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    setFormData({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      category: task.category,
      priority: task.priority,
      tags: task.tags
    });
    setIsEditMode(true);
    setEditingTaskId(taskId);
    setFormError(null);
    setIsFormOpen(true);
  };
  
  // Handle form submission
  const handleSubmitForm = async () => {
    try {
      setFormError(null);
      
      // Validate form
      if (!formData.title.trim()) {
        setFormError('Title is required');
        return;
      }
      
      if (isEditMode && editingTaskId) {
        // Update existing task
        await updateTask(editingTaskId, {
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : null,
          category: formData.category as 'application' | 'scholarship' | 'financial' | 'testing' | 'visit' | 'other' | 'deadline',
          priority: formData.priority,
          tags: formData.tags
        });
      } else {
        // Create new task
        if (!currentStudent?.id) {
          setFormError('No student selected');
          return;
        }
        
        await createTask({
          studentId: currentStudent.id,
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : null,
          completed: false,
          category: formData.category as 'application' | 'scholarship' | 'financial' | 'testing' | 'visit' | 'other' | 'deadline',
          sourcePins: [],
          priority: formData.priority as 'high' | 'medium' | 'low',
          tags: formData.tags,
          reminderDates: []
        });
      }
      
      // Close form on success
      setIsFormOpen(false);
    } catch (err) {
      console.error('Error submitting task form:', err);
      setFormError('Failed to save task: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // Filter and sort tasks
  const filteredAndSortedTasks = (tasks || [])
    .filter(task => {
      // Apply date filter if provided
      if (filterDate && task.dueDate) {
        const taskDate = new Date(task.dueDate);
        if (!isSameDay(taskDate, filterDate)) return false;
      }
      return true;
    })
    .filter(task => {
      // Apply school filter if provided
      if (filterSchool) {
        const schoolLower = filterSchool.toLowerCase();
        const matchesSchool = 
          task.title.toLowerCase().includes(schoolLower) ||
          task.description.toLowerCase().includes(schoolLower) ||
          (task.tags || []).some(tag => tag.toLowerCase().includes(schoolLower));
        if (!matchesSchool) return false;
      }
      return true;
    })
    .filter(task => {
      // Apply plan filter if provided
      if (filterPlan) {
        const planMatches = task.sourcePins?.includes(filterPlan);
        if (!planMatches) return false;
      }
      return true;
    })
    .filter(task => {
      // Apply completion filter
      if (filter === 'completed') return task.completed;
      if (filter === 'incomplete') return !task.completed;
      return true;
    })
    .filter(task => {
      // Apply search filter
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.category.toLowerCase().includes(searchLower) ||
        (task.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'dueDate') {
        // Sort by due date (null dates at the end)
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'priority') {
        // Sort by priority (high > medium > low)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else {
        // Sort by category
        return a.category.localeCompare(b.category);
      }
    });
  
  // Get priority color
  const getPriorityColor = (priority: string): 'error' | 'warning' | 'success' => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'warning';
    }
  };
  
  // Get task icon
  const getTaskIcon = (task: { completed: boolean; dueDate: string | null }) => {
    if (task.completed) {
      return <AssignmentTurnedInIcon color="success" />;
    }
    
    if (task.dueDate && new Date(task.dueDate) < new Date()) {
      return <AssignmentLateIcon color="error" />;
    }
    
    return <AssignmentIcon color="primary" />;
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Tasks</Typography>
          {filterDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Filtered for {filterDate.toLocaleDateString()}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => window.dispatchEvent(new CustomEvent('clearTaskFilter'))}
                sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
              >
                Show All
              </Button>
            </Box>
          )}
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenNewTaskForm}
          disabled={!currentStudent}
        >
          Add Task
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={handleSearchChange}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="filter-label">Filter</InputLabel>
            <Select
              labelId="filter-label"
              value={filter}
              label="Filter"
              onChange={handleFilterChange}
              startAdornment={<FilterListIcon fontSize="small" sx={{ mr: 1 }} />}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="incomplete">Incomplete</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="sort-label">Sort By</InputLabel>
            <Select
              labelId="sort-label"
              value={sortBy}
              label="Sort By"
              onChange={handleSortChange}
              startAdornment={<SortIcon fontSize="small" sx={{ mr: 1 }} />}
            >
              <MenuItem value="dueDate">Due Date</MenuItem>
              <MenuItem value="priority">Priority</MenuItem>
              <MenuItem value="category">Category</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : filteredAndSortedTasks.length === 0 ? (
          <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
            {searchTerm ? 'No tasks match your search' : 'No tasks available'}
          </Typography>
        ) : (
          <List>
            {filteredAndSortedTasks.map((task) => (
              <ListItem
                key={task.id}
                dense
                divider
                sx={{
                  bgcolor: task.completed ? 'action.hover' : 'inherit',
                  textDecoration: task.completed ? 'line-through' : 'none',
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task.id, task.completed)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemIcon>
                  {getTaskIcon(task)}
                </ListItemIcon>
                <ListItemText
                  primary={task.title}
                  secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {task.description && (
                        <Typography variant="body2" component="span">
                          {task.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {task.dueDate && (
                          <Chip
                            label={`Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                            size="small"
                            color={new Date(task.dueDate) < new Date() && !task.completed ? 'error' : 'default'}
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={task.priority}
                          size="small"
                          color={getPriorityColor(task.priority)}
                          variant="outlined"
                        />
                        <Chip
                          label={task.category}
                          size="small"
                          variant="outlined"
                        />
                        {(task.tags || []).map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Edit">
                    <IconButton
                      edge="end"
                      onClick={() => handleOpenEditTaskForm(task.id)}
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteTask(task.id)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      
      {/* Task Form Dialog */}
      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditMode ? 'Edit Task' : 'New Task'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          
          <TextField
            label="Title"
            fullWidth
            margin="normal"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Due Date"
              value={formData.dueDate}
              onChange={(date: Date | null) => setFormData({ ...formData, dueDate: date })}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <MenuItem value="application">Application</MenuItem>
              <MenuItem value="financial">Financial Aid</MenuItem>
              <MenuItem value="visit">Campus Visit</MenuItem>
              <MenuItem value="test">Test Prep</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}
            >
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Tags (comma separated)"
            fullWidth
            margin="normal"
            value={formData.tags.join(', ')}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
            helperText="Enter tags separated by commas"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitForm} variant="contained" color="primary">
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TaskList;
