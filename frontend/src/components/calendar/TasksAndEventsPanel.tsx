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
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
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

interface CalendarItemFormData {
  title: string;
  description: string;
  date: Date;
  type: string;
}

interface TasksAndEventsPanelProps {
  filterDate?: Date;
  filterSchool?: string;
  filterPlan?: string;
}

const TasksAndEventsPanel: React.FC<TasksAndEventsPanelProps> = ({ filterDate, filterSchool, filterPlan }) => {
  const { currentStudent } = useWizard();
  const { tasks, calendarItems, isLoading, error, createTask, updateTask, deleteTask, createCalendarItem, updateCalendarItem, deleteCalendarItem } = useCalendar();
  
  // State for filtering and sorting
  const [filter, setFilter] = useState<'all' | 'tasks' | 'events' | 'completed' | 'incomplete'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'category' | 'type'>('dueDate');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // State for task form
  const [isTaskFormOpen, setIsTaskFormOpen] = useState<boolean>(false);
  const [isTaskEditMode, setIsTaskEditMode] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    dueDate: null,
    category: 'application',
    priority: 'medium',
    tags: []
  });
  
  // State for calendar item form
  const [isEventFormOpen, setIsEventFormOpen] = useState<boolean>(false);
  const [isEventEditMode, setIsEventEditMode] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormData, setEventFormData] = useState<CalendarItemFormData>({
    title: '',
    description: '',
    date: new Date(),
    type: 'event'
  });
  
  const [formError, setFormError] = useState<string | null>(null);
  
  // Handle filter change
  const handleFilterChange = (event: SelectChangeEvent<'all' | 'tasks' | 'events' | 'completed' | 'incomplete'>) => {
    setFilter(event.target.value as 'all' | 'tasks' | 'events' | 'completed' | 'incomplete');
  };
  
  // Handle sort change
  const handleSortChange = (event: SelectChangeEvent<'dueDate' | 'priority' | 'category' | 'type'>) => {
    setSortBy(event.target.value as 'dueDate' | 'priority' | 'category' | 'type');
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
  
  // Handle calendar item deletion
  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteCalendarItem(eventId);
      } catch (err) {
        console.error('Error deleting event:', err);
      }
    }
  };
  
  // Handle opening the form for creating a new task
  const handleOpenNewTaskForm = () => {
    setTaskFormData({
      title: '',
      description: '',
      dueDate: filterDate || null,
      category: 'application',
      priority: 'medium',
      tags: []
    });
    setIsTaskEditMode(false);
    setEditingTaskId(null);
    setFormError(null);
    setIsTaskFormOpen(true);
  };
  
  // Handle opening the form for creating a new event
  const handleOpenNewEventForm = () => {
    setEventFormData({
      title: '',
      description: '',
      date: filterDate || new Date(),
      type: 'event'
    });
    setIsEventEditMode(false);
    setEditingEventId(null);
    setFormError(null);
    setIsEventFormOpen(true);
  };
  
  // Handle opening the form for editing a task
  const handleOpenEditTaskForm = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    setTaskFormData({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      category: task.category,
      priority: task.priority,
      tags: task.tags
    });
    setIsTaskEditMode(true);
    setEditingTaskId(taskId);
    setFormError(null);
    setIsTaskFormOpen(true);
  };
  
  // Handle opening the form for editing an event
  const handleOpenEditEventForm = (eventId: string) => {
    const event = calendarItems.find(e => e.id === eventId);
    if (!event) return;
    
    setEventFormData({
      title: event.title,
      description: event.description,
      date: new Date(event.date),
      type: event.type
    });
    setIsEventEditMode(true);
    setEditingEventId(eventId);
    setFormError(null);
    setIsEventFormOpen(true);
  };
  
  // Handle task form submission
  const handleSubmitTaskForm = async () => {
    try {
      setFormError(null);
      
      if (!taskFormData.title.trim()) {
        setFormError('Title is required');
        return;
      }
      
      if (isTaskEditMode && editingTaskId) {
        await updateTask(editingTaskId, {
          title: taskFormData.title,
          description: taskFormData.description,
          dueDate: taskFormData.dueDate ? taskFormData.dueDate.toISOString().split('T')[0] : null,
          category: taskFormData.category as 'application' | 'scholarship' | 'financial' | 'testing' | 'visit' | 'other' | 'deadline',
          priority: taskFormData.priority,
          tags: taskFormData.tags
        });
      } else {
        if (!currentStudent?.id) {
          setFormError('No student selected');
          return;
        }
        
        await createTask({
          studentId: currentStudent.id,
          title: taskFormData.title,
          description: taskFormData.description,
          dueDate: taskFormData.dueDate ? taskFormData.dueDate.toISOString().split('T')[0] : null,
          completed: false,
          category: taskFormData.category as 'application' | 'scholarship' | 'financial' | 'testing' | 'visit' | 'other' | 'deadline',
          sourcePins: [],
          priority: taskFormData.priority as 'high' | 'medium' | 'low',
          tags: taskFormData.tags,
          reminderDates: []
        });
      }
      
      setIsTaskFormOpen(false);
    } catch (err) {
      console.error('Error submitting task form:', err);
      setFormError('Failed to save task: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // Handle event form submission
  const handleSubmitEventForm = async () => {
    try {
      setFormError(null);
      
      if (!eventFormData.title.trim()) {
        setFormError('Title is required');
        return;
      }
      
      if (isEventEditMode && editingEventId) {
        await updateCalendarItem(editingEventId, {
          title: eventFormData.title,
          description: eventFormData.description,
          date: eventFormData.date.toISOString().split('T')[0],
          type: eventFormData.type as 'deadline' | 'event' | 'reminder' | 'appointment' | 'task'
        });
      } else {
        if (!currentStudent?.id) {
          setFormError('No student selected');
          return;
        }
        
        await createCalendarItem({
          studentId: currentStudent.id,
          title: eventFormData.title,
          description: eventFormData.description,
          date: eventFormData.date.toISOString().split('T')[0],
          type: eventFormData.type as 'deadline' | 'event' | 'reminder' | 'appointment' | 'task',
          sourcePins: []
        });
      }
      
      setIsEventFormOpen(false);
    } catch (err) {
      console.error('Error submitting event form:', err);
      setFormError('Failed to save event: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // Combine and filter tasks and calendar items
  const combinedItems = [
    ...(tasks || []).map(task => ({
      ...task,
      itemType: 'task' as const,
      date: task.dueDate,
      sortDate: task.dueDate ? new Date(task.dueDate) : new Date('9999-12-31')
    })),
    ...(calendarItems || []).map(item => ({
      ...item,
      itemType: 'event' as const,
      date: item.date,
      sortDate: new Date(item.date),
      completed: false,
      priority: 'medium' as const,
      category: item.type
    }))
  ]
    .filter(item => {
      // Apply date filter if provided
      if (filterDate && item.date) {
        const itemDate = new Date(item.date);
        if (!isSameDay(itemDate, filterDate)) return false;
      }
      return true;
    })
    .filter(item => {
      // Apply school filter if provided
      if (filterSchool) {
        const schoolLower = filterSchool.toLowerCase();
        const matchesSchool = 
          item.title.toLowerCase().includes(schoolLower) ||
          item.description.toLowerCase().includes(schoolLower) ||
          (item.itemType === 'task' && (item.tags || []).some(tag => tag.toLowerCase().includes(schoolLower)));
        if (!matchesSchool) return false;
      }
      return true;
    })
    .filter(item => {
      // Apply plan filter if provided
      if (filterPlan) {
        const planMatches = item.sourcePins?.includes(filterPlan);
        if (!planMatches) return false;
      }
      return true;
    })
    .filter(item => {
      // Apply type/completion filter
      if (filter === 'tasks') return item.itemType === 'task';
      if (filter === 'events') return item.itemType === 'event';
      if (filter === 'completed') return item.itemType === 'task' && item.completed;
      if (filter === 'incomplete') return item.itemType === 'task' && !item.completed;
      return true;
    })
    .filter(item => {
      // Apply search filter
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.itemType === 'task' && (item.tags || []).some(tag => tag.toLowerCase().includes(searchLower)))
      );
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'dueDate') {
        return a.sortDate.getTime() - b.sortDate.getTime();
      } else if (sortBy === 'priority') {
        if (a.itemType === 'event' && b.itemType === 'event') return 0;
        if (a.itemType === 'event') return 1;
        if (b.itemType === 'event') return -1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortBy === 'type') {
        return a.itemType.localeCompare(b.itemType);
      } else {
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
  
  // Get event type color
  const getEventTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (type) {
      case 'event': return 'primary';
      case 'deadline': return 'error';
      case 'reminder': return 'warning';
      case 'appointment': return 'secondary';
      case 'task': return 'info';
      default: return 'primary';
    }
  };
  
  // Get task icon
  const getTaskIcon = (item: any) => {
    if (item.itemType === 'event') {
      return <EventIcon color={getEventTypeColor(item.type)} />;
    }
    
    if (item.completed) {
      return <AssignmentTurnedInIcon color="success" />;
    }
    
    if (item.date && new Date(item.date) < new Date()) {
      return <AssignmentLateIcon color="error" />;
    }
    
    return <AssignmentIcon color="primary" />;
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Tasks & Events</Typography>
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenNewTaskForm}
            disabled={!currentStudent}
            size="small"
          >
            Add Task
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleOpenNewEventForm}
            disabled={!currentStudent}
            size="small"
          >
            Add Event
          </Button>
        </Box>
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
              <MenuItem value="tasks">Tasks Only</MenuItem>
              <MenuItem value="events">Events Only</MenuItem>
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
              <MenuItem value="type">Type</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : combinedItems.length === 0 ? (
          <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
            {searchTerm ? 'No items match your search' : 'No tasks or events available'}
          </Typography>
        ) : (
          <List>
            {combinedItems.map((item) => (
              <ListItem
                key={`${item.itemType}-${item.id}`}
                dense
                divider
                sx={{
                  bgcolor: item.itemType === 'task' && item.completed ? 'action.hover' : 'inherit',
                  textDecoration: item.itemType === 'task' && item.completed ? 'line-through' : 'none',
                }}
              >
                {item.itemType === 'task' && (
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={item.completed}
                      onChange={() => handleToggleComplete(item.id, item.completed)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                )}
                <ListItemIcon>
                  {getTaskIcon(item)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ flexGrow: 1 }}>
                        {item.title}
                      </Typography>
                      <Chip
                        label={item.itemType === 'task' ? 'Task' : 'Event'}
                        size="small"
                        color={item.itemType === 'task' ? 'warning' : 'primary'}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {item.description && (
                        <Typography variant="body2" component="span">
                          {item.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {item.date && (
                          <Chip
                            label={`${item.itemType === 'task' ? 'Due' : 'Date'}: ${new Date(item.date).toLocaleDateString()}`}
                            size="small"
                            color={item.itemType === 'task' && new Date(item.date) < new Date() && !item.completed ? 'error' : 'default'}
                            variant="outlined"
                          />
                        )}
                        {item.itemType === 'task' && (
                          <Chip
                            label={item.priority}
                            size="small"
                            color={getPriorityColor(item.priority)}
                            variant="outlined"
                          />
                        )}
                        {item.itemType === 'event' && (
                          <Chip
                            label={item.type}
                            size="small"
                            color={getEventTypeColor(item.type)}
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={item.category}
                          size="small"
                          variant="outlined"
                        />
                        {item.itemType === 'task' && (item.tags || []).map((tag, index) => (
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
                      onClick={() => item.itemType === 'task' ? handleOpenEditTaskForm(item.id) : handleOpenEditEventForm(item.id)}
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      onClick={() => item.itemType === 'task' ? handleDeleteTask(item.id) : handleDeleteEvent(item.id)}
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
      <Dialog open={isTaskFormOpen} onClose={() => setIsTaskFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isTaskEditMode ? 'Edit Task' : 'New Task'}</DialogTitle>
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
            value={taskFormData.title}
            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
            required
          />
          
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={taskFormData.description}
            onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Due Date"
              value={taskFormData.dueDate}
              onChange={(date: Date | null) => setTaskFormData({ ...taskFormData, dueDate: date })}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={taskFormData.category}
              label="Category"
              onChange={(e) => setTaskFormData({ ...taskFormData, category: e.target.value })}
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
              value={taskFormData.priority}
              label="Priority"
              onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as 'high' | 'medium' | 'low' })}
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
            value={taskFormData.tags.join(', ')}
            onChange={(e) => setTaskFormData({ ...taskFormData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
            helperText="Enter tags separated by commas"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsTaskFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitTaskForm} variant="contained" color="primary">
            {isTaskEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Event Form Dialog */}
      <Dialog open={isEventFormOpen} onClose={() => setIsEventFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEventEditMode ? 'Edit Event' : 'New Event'}</DialogTitle>
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
            value={eventFormData.title}
            onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
            required
          />
          
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={eventFormData.description}
            onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date"
              value={eventFormData.date}
              onChange={(date: Date | null) => setEventFormData({ ...eventFormData, date: date || new Date() })}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select
              value={eventFormData.type}
              label="Type"
              onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value })}
            >
              <MenuItem value="event">Event</MenuItem>
              <MenuItem value="deadline">Deadline</MenuItem>
              <MenuItem value="reminder">Reminder</MenuItem>
              <MenuItem value="appointment">Appointment</MenuItem>
              <MenuItem value="task">Task</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEventFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitEventForm} variant="contained" color="primary">
            {isEventEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TasksAndEventsPanel;
