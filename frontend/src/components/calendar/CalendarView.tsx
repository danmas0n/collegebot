import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useCalendar } from '../../contexts/CalendarContext';
import TasksAndEventsPanel from './TasksAndEventsPanel';

interface CalendarViewProps {
  studentId: string;
}

interface CalendarItemFormData {
  title: string;
  description: string;
  date: Date;
  type: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ studentId }) => {
  const { calendarItems, tasks, isLoading, error, createCalendarItem, updateCalendarItem, deleteCalendarItem } = useCalendar();
  
  // State for calendar navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [taskFilterDate, setTaskFilterDate] = useState<Date | undefined>(new Date());
  
  // State for calendar item form
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CalendarItemFormData>({
    title: '',
    description: '',
    date: new Date(),
    type: 'event'
  });
  const [formError, setFormError] = useState<string | null>(null);
  
  // Handle month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };
  
  // Handle date selection
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setTaskFilterDate(date);
  };
  
  // Handle clearing task filter
  useEffect(() => {
    const handleClearFilter = () => {
      setTaskFilterDate(undefined);
    };
    
    window.addEventListener('clearTaskFilter', handleClearFilter);
    return () => window.removeEventListener('clearTaskFilter', handleClearFilter);
  }, []);
  
  // Handle opening the form for creating a new calendar item
  const handleOpenNewItemForm = (date: Date = selectedDate) => {
    setFormData({
      title: '',
      description: '',
      date,
      type: 'event'
    });
    setIsEditMode(false);
    setEditingItemId(null);
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
      
      if (isEditMode && editingItemId) {
        // Update existing item
        await updateCalendarItem(editingItemId, {
          title: formData.title,
          description: formData.description,
          date: formData.date.toISOString().split('T')[0],
          type: formData.type as 'deadline' | 'event' | 'reminder' | 'appointment' | 'task'
        });
      } else {
        // Create new item
        await createCalendarItem({
          studentId,
          title: formData.title,
          description: formData.description,
          date: formData.date.toISOString().split('T')[0],
          type: formData.type as 'deadline' | 'event' | 'reminder' | 'appointment' | 'task',
          sourcePins: []
        });
      }
      
      // Close form on success
      setIsFormOpen(false);
    } catch (err) {
      console.error('Error submitting calendar item form:', err);
      setFormError('Failed to save calendar item: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // Generate calendar days
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  
  // Get calendar items for a specific date
  const getItemsForDate = (date: Date) => {
    return calendarItems.filter(item => {
      const itemDate = new Date(item.date);
      return isSameDay(itemDate, date);
    });
  };
  
  // Get tasks due on a specific date
  const getTasksForDate = (date: Date) => {
    return (tasks || []).filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return isSameDay(taskDate, date);
    });
  };
  
  // Get color for item type
  const getItemTypeColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (type) {
      case 'event': return 'primary';
      case 'deadline': return 'error';
      case 'reminder': return 'warning';
      case 'appointment': return 'secondary';
      case 'task': return 'info';
      default: return 'primary';
    }
  };
  
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Calendar - Full Width */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            {/* Calendar header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={handlePrevMonth}>
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" sx={{ mx: 1 }}>
                  {format(currentMonth, 'MMMM yyyy')}
                </Typography>
                <IconButton onClick={handleNextMonth}>
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<TodayIcon />}
                  onClick={handleToday}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  Today
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenNewItemForm()}
                  size="small"
                >
                  Add Event
                </Button>
              </Box>
            </Box>
            
            {/* Calendar grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Box
                  key={day}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    bgcolor: 'background.default',
                    borderRadius: 1
                  }}
                >
                  {day}
                </Box>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map(day => {
                const dayItems = getItemsForDate(day);
                const dayTasks = getTasksForDate(day);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const totalItems = dayItems.length + dayTasks.length;
                
                // Determine if there are overdue tasks
                const hasOverdueTasks = dayTasks.some(task => 
                  !task.completed && new Date(task.dueDate!) < new Date()
                );
                
                return (
                  <Box
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    sx={{
                      p: 1,
                      height: 100,
                      overflow: 'auto',
                      bgcolor: isSelected ? 'primary.light' : isCurrentMonth ? 'background.paper' : 'action.hover',
                      color: isSelected ? 'primary.contrastText' : 'inherit',
                      border: isSelected ? '2px solid' : '1px solid',
                      borderColor: isSelected ? 'primary.main' : hasOverdueTasks ? 'error.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      '&:hover': {
                        bgcolor: isSelected ? 'primary.light' : 'action.hover'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: isSameDay(day, new Date()) ? 'bold' : 'normal' }}>
                      {format(day, 'd')}
                    </Typography>
                    
                    {/* Show calendar items first */}
                    {dayItems.slice(0, 1).map(item => (
                      <Chip
                        key={`item-${item.id}`}
                        label={item.title}
                        size="small"
                        color={getItemTypeColor(item.type)}
                        sx={{ my: 0.25, maxWidth: '100%', overflow: 'hidden', fontSize: '0.7rem' }}
                      />
                    ))}
                    
                    {/* Show tasks */}
                    {dayTasks.slice(0, totalItems > 2 ? 1 : 2).map(task => (
                      <Chip
                        key={`task-${task.id}`}
                        label={task.title}
                        size="small"
                        color={task.completed ? 'success' : hasOverdueTasks ? 'error' : 'warning'}
                        variant="outlined"
                        sx={{ my: 0.25, maxWidth: '100%', overflow: 'hidden', fontSize: '0.7rem' }}
                      />
                    ))}
                    
                    {/* Show count if more items */}
                    {totalItems > 2 && (
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
                        +{totalItems - 2} more
                      </Typography>
                    )}
                    
                    {/* Visual indicator for tasks */}
                    {dayTasks.length > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: hasOverdueTasks ? 'error.main' : dayTasks.some(t => !t.completed) ? 'warning.main' : 'success.main'
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Box>
        
        {/* Tasks and Events Panel */}
        <Box sx={{ width: 400, flexShrink: 0 }}>
          <TasksAndEventsPanel filterDate={taskFilterDate} />
        </Box>
      </Box>
      
      {/* Calendar Item Form Dialog */}
      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditMode ? 'Edit Event' : 'New Event'}</DialogTitle>
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
              label="Date"
              value={formData.date}
              onChange={(date: Date | null) => setFormData({ ...formData, date: date || new Date() })}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              label="Type"
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
          <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitForm} variant="contained" color="primary">
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarView;
