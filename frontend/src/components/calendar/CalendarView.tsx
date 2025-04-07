import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  Chip,
  Divider,
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
  CircularProgress,
  Tooltip
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EventIcon from '@mui/icons-material/Event';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useCalendar } from '../../contexts/CalendarContext';
import { useWizard } from '../../contexts/WizardContext';
import TaskList from './TaskList';

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
  const { calendarItems, isLoading, error, createCalendarItem, updateCalendarItem, deleteCalendarItem } = useCalendar();
  
  // State for calendar navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
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
  };
  
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
  
  // Handle opening the form for editing a calendar item
  const handleOpenEditItemForm = (itemId: string) => {
    const item = calendarItems.find(i => i.id === itemId);
    if (!item) return;
    
    setFormData({
      title: item.title,
      description: item.description,
      date: new Date(item.date),
      type: item.type
    });
    setIsEditMode(true);
    setEditingItemId(itemId);
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
          type: formData.type
        });
      } else {
        // Create new item
        await createCalendarItem({
          studentId,
          title: formData.title,
          description: formData.description,
          date: formData.date.toISOString().split('T')[0],
          type: formData.type,
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
  
  // Handle calendar item deletion
  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this calendar item?')) {
      try {
        await deleteCalendarItem(itemId);
      } catch (err) {
        console.error('Error deleting calendar item:', err);
      }
    }
  };
  
  // Generate calendar days
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });
  
  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    return calendarItems.filter(item => {
      const itemDate = new Date(item.date);
      return isSameDay(itemDate, date);
    });
  };
  
  // Get items for the selected date
  const selectedDateItems = getItemsForDate(selectedDate);
  
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
      
      <Grid container spacing={2}>
        {/* Calendar */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
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
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                
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
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: isSelected ? 'primary.light' : 'action.hover'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: isSameDay(day, new Date()) ? 'bold' : 'normal' }}>
                      {format(day, 'd')}
                    </Typography>
                    
                    {dayItems.slice(0, 2).map(item => (
                      <Chip
                        key={item.id}
                        label={item.title}
                        size="small"
                        color={getItemTypeColor(item.type)}
                        sx={{ my: 0.5, maxWidth: '100%', overflow: 'hidden' }}
                      />
                    ))}
                    
                    {dayItems.length > 2 && (
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
                        +{dayItems.length - 2} more
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>
          
          {/* Selected date details */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleOpenNewItemForm(selectedDate)}
                size="small"
              >
                Add Event
              </Button>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : selectedDateItems.length === 0 ? (
              <Typography variant="body2" sx={{ textAlign: 'center', p: 2 }}>
                No events scheduled for this day
              </Typography>
            ) : (
              <Box>
                {selectedDateItems.map(item => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.paper'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EventIcon color={getItemTypeColor(item.type)} sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">{item.title}</Typography>
                      </Box>
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditItemForm(item.id)}
                            sx={{ mr: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    
                    {item.description && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {item.description}
                      </Typography>
                    )}
                    
                    <Chip
                      label={item.type}
                      size="small"
                      color={getItemTypeColor(item.type)}
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Task list */}
        <Grid item xs={12} md={4}>
          <TaskList />
        </Grid>
      </Grid>
      
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
