import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Button,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SchoolIcon from '@mui/icons-material/School';
import PaidIcon from '@mui/icons-material/Paid';
import { useResearch } from '../../contexts/ResearchContext';
import { TaskList } from './TaskList';
import { ResearchFinding } from '../../types/research';

// Extended research finding with entity information
interface EnhancedFinding extends ResearchFinding {
  entityName: string;
  entityType: 'college' | 'scholarship';
  entityId?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  findings: EnhancedFinding[];
}

interface CalendarViewProps {
  studentId: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ studentId }) => {
  const { tasks } = useResearch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'calendar' | 'tasks'>('calendar');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Generate calendar days for the current month
  useEffect(() => {
    const days: CalendarDay[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Add days from previous month to fill the first week
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        findings: []
      });
    }
    
    // Add days of the current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        findings: []
      });
    }
    
    // Add days from next month to complete the last week
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({
          date,
          isCurrentMonth: false,
          findings: []
        });
      }
    }
    
    // Add findings to calendar days
    const allFindings = tasks.flatMap(task => 
      task.findings.map(finding => ({
        ...finding,
        entityName: task.entityName,
        entityType: task.entityType
      }))
    );
    
    // Find dates in findings
    const dateRegex = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi;
    
    allFindings.forEach(finding => {
      const dateMatches = finding.detail.match(dateRegex);
      if (dateMatches) {
        dateMatches.forEach(dateStr => {
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              // Find the corresponding calendar day
              const dayIndex = days.findIndex(day => 
                day.date.getDate() === date.getDate() &&
                day.date.getMonth() === date.getMonth() &&
                day.date.getFullYear() === date.getFullYear()
              );
              
              if (dayIndex >= 0) {
                days[dayIndex].findings.push(finding);
              }
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        });
      }
    });
    
    setCalendarDays(days);
  }, [currentDate, tasks]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
  };

  const handleViewChange = (_: React.SyntheticEvent, newValue: 'calendar' | 'tasks') => {
    setView(newValue);
  };

  const handleCategoryFilter = (category: string | null) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  // Get all findings for the selected date
  const selectedDateFindings = selectedDate
    ? calendarDays.find(day => 
        day.date.getDate() === selectedDate.getDate() &&
        day.date.getMonth() === selectedDate.getMonth() &&
        day.date.getFullYear() === selectedDate.getFullYear()
      )?.findings || []
    : [];

  // Get all findings for task view
  const allFindings = tasks.flatMap(task => 
    task.findings
      .filter(finding => !selectedCategory || finding.category === selectedCategory)
      .map(finding => ({
        ...finding,
        entityName: task.entityName,
        entityType: task.entityType
      }))
  );

  // Group findings by category
  const findingsByCategory = allFindings.reduce((acc, finding) => {
    if (!acc[finding.category]) {
      acc[finding.category] = [];
    }
    acc[finding.category].push(finding);
    return acc;
  }, {} as Record<string, any[]>);

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'deadline':
        return 'Deadlines';
      case 'requirement':
        return 'Requirements';
      case 'contact':
        return 'Contacts';
      case 'financial':
        return 'Financial';
      default:
        return 'Other';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'deadline':
        return <CalendarTodayIcon fontSize="small" />;
      case 'requirement':
        return <AssignmentIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={view} onChange={handleViewChange} aria-label="calendar views">
          <Tab 
            icon={<CalendarTodayIcon />} 
            label="Calendar" 
            value="calendar" 
            id="calendar-tab"
            aria-controls="calendar-panel"
          />
          <Tab 
            icon={<AssignmentIcon />} 
            label="Tasks" 
            value="tasks" 
            id="tasks-tab"
            aria-controls="tasks-panel"
          />
        </Tabs>
      </Box>

      {/* Calendar View */}
      <Box
        role="tabpanel"
        hidden={view !== 'calendar'}
        id="calendar-panel"
        aria-labelledby="calendar-tab"
      >
        {view === 'calendar' && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={handlePrevMonth}>
                  <NavigateBeforeIcon />
                </IconButton>
                <Typography variant="h6">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Typography>
                <IconButton onClick={handleNextMonth}>
                  <NavigateNextIcon />
                </IconButton>
              </Box>
              <Button 
                variant="outlined" 
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </Box>

            <Grid container spacing={1}>
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Grid item xs={12/7} key={day}>
                  <Box sx={{ 
                    textAlign: 'center', 
                    p: 1, 
                    fontWeight: 'bold',
                    bgcolor: 'grey.100',
                    borderRadius: 1
                  }}>
                    {day}
                  </Box>
                </Grid>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day, index) => (
                <Grid item xs={12/7} key={index}>
                  <Paper 
                    elevation={selectedDate && 
                      selectedDate.getDate() === day.date.getDate() && 
                      selectedDate.getMonth() === day.date.getMonth() && 
                      selectedDate.getFullYear() === day.date.getFullYear() ? 3 : 0}
                    sx={{ 
                      p: 1, 
                      height: '100px',
                      cursor: 'pointer',
                      bgcolor: day.isCurrentMonth ? 'background.paper' : 'grey.50',
                      color: day.isCurrentMonth ? 'text.primary' : 'text.secondary',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onClick={() => handleDateClick(day)}
                  >
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 
                          new Date().getDate() === day.date.getDate() && 
                          new Date().getMonth() === day.date.getMonth() && 
                          new Date().getFullYear() === day.date.getFullYear() 
                            ? 'bold' 
                            : 'normal'
                      }}
                    >
                      {day.date.getDate()}
                    </Typography>
                    <Box sx={{ mt: 'auto', overflow: 'hidden' }}>
                      {day.findings.length > 0 && (
                        <Chip 
                          size="small" 
                          label={`${day.findings.length} item${day.findings.length > 1 ? 's' : ''}`}
                          color="primary"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Selected date details */}
            {selectedDate && selectedDateFindings.length > 0 && (
              <Paper sx={{ mt: 2, p: 2 }} variant="outlined">
                <Typography variant="h6">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </Typography>
                <Divider sx={{ my: 1 }} />
                {selectedDateFindings.map((finding, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {finding.entityType === 'college' ? (
                        <SchoolIcon color="primary" fontSize="small" />
                      ) : (
                        <PaidIcon color="secondary" fontSize="small" />
                      )}
                      <Typography variant="subtitle2">
                        {finding.entityName}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={finding.category} 
                        color={finding.category === 'deadline' ? 'error' : 'default'}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {finding.detail}
                    </Typography>
                    {finding.source && (
                      <Typography variant="caption" color="text.secondary">
                        Source: {finding.source}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Paper>
            )}
          </>
        )}
      </Box>

      {/* Tasks View */}
      <Box
        role="tabpanel"
        hidden={view !== 'tasks'}
        id="tasks-panel"
        aria-labelledby="tasks-tab"
      >
        {view === 'tasks' && (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {Object.keys(findingsByCategory).map(category => (
                <Chip
                  key={category}
                  icon={getCategoryIcon(category)}
                  label={`${getCategoryLabel(category)} (${findingsByCategory[category].length})`}
                  onClick={() => handleCategoryFilter(category)}
                  color={selectedCategory === category ? 'primary' : 'default'}
                  variant={selectedCategory === category ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
            
            <TaskList 
              findings={allFindings}
              studentId={studentId}
            />
          </>
        )}
      </Box>
    </Paper>
  );
};
