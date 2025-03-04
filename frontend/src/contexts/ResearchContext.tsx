import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertColor, Button } from '@mui/material';
import { useWizard } from './WizardContext';
import { useNotification } from './NotificationContext';
import { ResearchTask, ResearchTaskUpdate, ResearchFinding } from '../types/research';
import { api } from '../utils/api';

interface ResearchContextType {
  tasks: ResearchTask[];
  loading: boolean;
  error: string | null;
  addTask: (task: Omit<ResearchTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ResearchTask>;
  updateTask: (taskId: string, updates: ResearchTaskUpdate) => Promise<ResearchTask>;
  addFinding: (taskId: string, finding: Omit<ResearchFinding, 'timestamp'>) => Promise<ResearchTask>;
  deleteTask: (taskId: string) => Promise<void>;
  clearTasks: () => Promise<void>;
}

const ResearchContext = createContext<ResearchContextType | undefined>(undefined);

export const ResearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentStudent } = useWizard();
  const { showNotification } = useNotification();
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tasks when student changes
  useEffect(() => {
    if (currentStudent?.id) {
      loadTasks();
    } else {
      setTasks([]);
    }
  }, [currentStudent?.id]);

  const loadTasks = async () => {
    if (!currentStudent?.id) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/research/tasks/${currentStudent.id}`);
      const data = await response.json();
      setTasks(data.tasks);
    } catch (error) {
      console.error('Error loading research tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load research tasks');
      showNotification('Failed to load research tasks', 'error', {
        persist: true,
        action: (
          <Button color="inherit" size="small" onClick={loadTasks}>
            Retry
          </Button>
        )
      });
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (task: Omit<ResearchTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResearchTask> => {
    if (!currentStudent?.id) {
      throw new Error('No student selected');
    }

    try {
      const response = await api.post('/api/research/tasks', {
        task: {
          ...task,
          studentId: currentStudent.id
        }
      });
      const newTask = await response.json();
      setTasks(prev => [...prev, newTask]);
      showNotification('Research task created', 'success', {
        autoHideDuration: 3000
      });
      return newTask;
    } catch (error) {
      console.error('Error adding research task:', error);
      const message = error instanceof Error ? error.message : 'Failed to add research task';
      setError(message);
      showNotification(message, 'error', {
        persist: true
      });
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: ResearchTaskUpdate): Promise<ResearchTask> => {
    try {
      const response = await api.put(`/api/research/tasks/${taskId}`, { updates });
      const updatedTask = await response.json();
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      if (updates.status === 'complete') {
        showNotification('Research completed', 'success', {
          autoHideDuration: 5000,
          action: (
            <Button color="inherit" size="small" onClick={() => {
              const task = tasks.find(t => t.id === taskId);
              if (task) {
                showNotification(`Found ${task.findings.length} findings for ${task.entityName}`, 'info', {
                  autoHideDuration: 8000
                });
              }
            }}>
              View Findings
            </Button>
          )
        });
      }
      return updatedTask;
    } catch (error) {
      console.error('Error updating research task:', error);
      const message = error instanceof Error ? error.message : 'Failed to update research task';
      setError(message);
      showNotification(message, 'error', {
        persist: true
      });
      throw error;
    }
  };

  const addFinding = async (taskId: string, finding: Omit<ResearchFinding, 'timestamp'>): Promise<ResearchTask> => {
    try {
      const response = await api.post(`/api/research/tasks/${taskId}/findings`, { finding });
      const updatedTask = await response.json();
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      showNotification('New finding added', 'info', {
        autoHideDuration: 3000
      });
      return updatedTask;
    } catch (error) {
      console.error('Error adding research finding:', error);
      const message = error instanceof Error ? error.message : 'Failed to add research finding';
      setError(message);
      showNotification(message, 'error', {
        persist: true
      });
      throw error;
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      await api.delete(`/api/research/tasks/${taskId}`);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      showNotification('Research task deleted', 'success', {
        autoHideDuration: 3000
      });
    } catch (error) {
      console.error('Error deleting research task:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete research task';
      setError(message);
      showNotification(message, 'error', {
        persist: true
      });
      throw error;
    }
  };

  const clearTasks = async (): Promise<void> => {
    if (!currentStudent?.id) return;

    try {
      await api.delete(`/api/research/tasks/${currentStudent.id}`);
      setTasks([]);
      showNotification('All research tasks cleared', 'success', {
        autoHideDuration: 3000
      });
    } catch (error) {
      console.error('Error clearing research tasks:', error);
      const message = error instanceof Error ? error.message : 'Failed to clear research tasks';
      setError(message);
      showNotification(message, 'error', {
        persist: true
      });
      throw error;
    }
  };

  const value = {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    addFinding,
    deleteTask,
    clearTasks
  };

  return (
    <ResearchContext.Provider value={value}>
      {children}
    </ResearchContext.Provider>
  );
};

export const useResearch = () => {
  const context = useContext(ResearchContext);
  if (context === undefined) {
    throw new Error('useResearch must be used within a ResearchProvider');
  }
  return context;
};
