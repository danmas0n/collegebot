import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface Notification {
  id: string;
  message: string;
  type: AlertColor;
  action?: React.ReactNode;
  autoHideDuration?: number;
  persist?: boolean;
}

interface NotificationContextType {
  showNotification: (
    message: string,
    type?: AlertColor,
    options?: {
      action?: React.ReactNode;
      autoHideDuration?: number;
      persist?: boolean;
    }
  ) => string;
  closeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((
    message: string,
    type: AlertColor = 'info',
    options?: {
      action?: React.ReactNode;
      autoHideDuration?: number;
      persist?: boolean;
    }
  ): string => {
    const id = `notification-${Date.now()}`;
    setNotifications(prev => [...prev, {
      id,
      message,
      type,
      action: options?.action,
      autoHideDuration: options?.autoHideDuration,
      persist: options?.persist
    }]);
    return id;
  }, []);

  const closeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const handleClose = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification }}>
      {children}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.autoHideDuration ?? 6000}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ bottom: `${(index * 80) + 24}px` }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%', alignItems: 'center' }}
            action={notification.action}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
