import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../utils/api';
import { useWizard } from './WizardContext';
import { CalendarItem, Task, PinResearchRequest } from '../types/calendar';

interface CalendarContextType {
  calendarItems: CalendarItem[];
  tasks: Task[];
  researchRequests: PinResearchRequest[];
  isLoading: boolean;
  error: string | null;
  loadCalendarItems: (studentId: string) => Promise<void>;
  loadTasks: (studentId: string) => Promise<void>;
  loadResearchRequests: (studentId: string) => Promise<void>;
  createCalendarItem: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CalendarItem>;
  updateCalendarItem: (itemId: string, updates: Partial<CalendarItem>) => Promise<CalendarItem>;
  deleteCalendarItem: (itemId: string) => Promise<void>;
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  startPinResearch: (pinIds: string[]) => Promise<PinResearchRequest>;
  getResearchRequest: (requestId: string) => Promise<PinResearchRequest>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const useCalendar = (): CalendarContextType => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
};

interface CalendarProviderProps {
  children: ReactNode;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({ children }) => {
  const { currentStudent } = useWizard();
  
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [researchRequests, setResearchRequests] = useState<PinResearchRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load calendar items for a student
  const loadCalendarItems = async (studentId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('CalendarContext: Loading calendar items for student:', studentId);
      const response = await api.get(`/api/calendar/${studentId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('CalendarContext: API error response:', errorData);
        throw new Error(errorData.error || `Failed to load calendar items: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('CalendarContext: Received calendar data:', data);
      console.log('CalendarContext: Calendar items count:', data.items?.length || 0);
      console.log('CalendarContext: Calendar items:', data.items);
      
      setCalendarItems(data.items || []);
    } catch (err) {
      console.error('Error loading calendar items:', err);
      setError('Failed to load calendar items: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load tasks for a student
  const loadTasks = async (studentId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get(`/api/tasks/${studentId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to load tasks: ${response.status}`);
      }
      
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load research requests for a student
  const loadResearchRequests = async (studentId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get(`/api/pin-research/${studentId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to load research requests: ${response.status}`);
      }
      
      const data = await response.json();
      setResearchRequests(data.requests || []);
    } catch (err) {
      console.error('Error loading research requests:', err);
      setError('Failed to load research requests: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a calendar item
  const createCalendarItem = async (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarItem> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post('/api/calendar', {
        item
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create calendar item: ${response.status}`);
      }
      
      const newItem = await response.json();
      
      // Update local state
      setCalendarItems(prev => [...prev, newItem]);
      
      return newItem;
    } catch (err) {
      console.error('Error creating calendar item:', err);
      setError('Failed to create calendar item: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update a calendar item
  const updateCalendarItem = async (itemId: string, updates: Partial<CalendarItem>): Promise<CalendarItem> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.put(`/api/calendar/${itemId}`, {
        updates
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to update calendar item: ${response.status}`);
      }
      
      const updatedItem = await response.json();
      
      // Update local state
      setCalendarItems(prev => 
        prev.map(item => item.id === itemId ? updatedItem : item)
      );
      
      return updatedItem;
    } catch (err) {
      console.error('Error updating calendar item:', err);
      setError('Failed to update calendar item: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a calendar item
  const deleteCalendarItem = async (itemId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.delete(`/api/calendar/${itemId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete calendar item: ${response.status}`);
      }
      
      // Update local state
      setCalendarItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Error deleting calendar item:', err);
      setError('Failed to delete calendar item: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a task
  const createTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post('/api/tasks', {
        task
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create task: ${response.status}`);
      }
      
      const newTask = await response.json();
      
      // Update local state
      setTasks(prev => [...prev, newTask]);
      
      return newTask;
    } catch (err) {
      console.error('Error creating task:', err);
      setError('Failed to create task: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update a task
  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.put(`/api/tasks/${taskId}`, {
        updates
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to update task: ${response.status}`);
      }
      
      const updatedTask = await response.json();
      
      // Update local state
      setTasks(prev => 
        prev.map(task => task.id === taskId ? updatedTask : task)
      );
      
      return updatedTask;
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a task
  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.delete(`/api/tasks/${taskId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete task: ${response.status}`);
      }
      
      // Update local state
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start pin research
  const startPinResearch = async (pinIds: string[]): Promise<PinResearchRequest> => {
    if (!currentStudent?.id) {
      throw new Error('No student selected');
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.post('/api/pin-research', {
        studentId: currentStudent.id,
        pinIds
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to start pin research: ${response.status}`);
      }
      
      const newRequest = await response.json();
      
      // Update local state
      setResearchRequests(prev => [...prev, newRequest]);
      
      return newRequest;
    } catch (err) {
      console.error('Error starting pin research:', err);
      setError('Failed to start pin research: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get a specific research request
  const getResearchRequest = async (requestId: string): Promise<PinResearchRequest> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get(`/api/pin-research/request/${requestId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to get research request: ${response.status}`);
      }
      
      const request = await response.json();
      
      return request;
    } catch (err) {
      console.error('Error getting research request:', err);
      setError('Failed to get research request: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load data when student changes
  useEffect(() => {
    if (currentStudent?.id) {
      // Load calendar items, tasks, and research requests
      Promise.all([
        loadCalendarItems(currentStudent.id).catch(() => {}),
        loadTasks(currentStudent.id).catch(() => {}),
        loadResearchRequests(currentStudent.id).catch(() => {})
      ]);
    } else {
      // Clear data when no student is selected
      setCalendarItems([]);
      setTasks([]);
      setResearchRequests([]);
    }
  }, [currentStudent?.id]);
  
  const value: CalendarContextType = {
    calendarItems,
    tasks,
    researchRequests,
    isLoading,
    error,
    loadCalendarItems,
    loadTasks,
    loadResearchRequests,
    createCalendarItem,
    updateCalendarItem,
    deleteCalendarItem,
    createTask,
    updateTask,
    deleteTask,
    startPinResearch,
    getResearchRequest
  };
  
  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};
