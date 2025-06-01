import React, { useState, useContext, createContext } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { WizardProvider, useWizard } from './contexts/WizardContext';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { Login } from './components/Login';
import { NavigationSidebar } from './components/NavigationSidebar';
import { StudentSelectionStage } from './components/stages/StudentSelectionStage';
import { StudentProfileStage } from './components/stages/StudentProfileStage';
import { CollegeInterestsStage } from './components/stages/CollegeInterestsStage';
import { BudgetStage } from './components/stages/BudgetStage';
import { DataCollectionStage } from './components/stages/DataCollectionStage';
import { RecommendationsStage } from './components/stages/RecommendationsStage';
import { MapStage } from './components/stages/MapStage';
import { PlanStage } from './components/stages/PlanStage';
import { CollaborationStage } from './components/stages/CollaborationStage';
import { AdminPanel } from './components/admin/AdminPanel';

// Sidebar width constants (must match NavigationSidebar.tsx)
const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

// Context for sidebar state
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};

const WizardContent: React.FC = () => {
  const { currentStage, currentStudent } = useWizard();
  const { currentUser, isWhitelisted } = useAuth();
  const { isCollapsed } = useSidebar();
  
  // Add/remove CSS class based on sidebar state
  React.useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    
    return () => {
      document.body.classList.remove('sidebar-collapsed');
    };
  }, [isCollapsed]);

  if (!currentUser || !isWhitelisted) {
    return <Login />;
  }

  const renderStage = () => {
    switch (currentStage) {
      case 'student-selection':
        return <StudentSelectionStage />;
      case 'student-profile':
        return <StudentProfileStage />;
      case 'college-interests':
        return <CollegeInterestsStage />;
      case 'budget':
        return <BudgetStage />;
      case 'data-collection':
        return <DataCollectionStage />;
      case 'recommendations':
        return <RecommendationsStage />;
      case 'map':
        return <MapStage />;
      case 'calendar':
        return <PlanStage />;
      case 'collaboration':
        return <CollaborationStage />;
      default:
        return null;
    }
  };

  // Hide sidebar entirely on student selection page
  if (currentStage === 'student-selection') {
    return (
      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        {renderStage()}
      </Container>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <NavigationSidebar />
      <div 
        style={{ 
          flexGrow: 1, 
          width: '100%',
          maxWidth: 'none',
          minWidth: 0,
          flex: '1 1 auto',
          padding: 0,
          height: '100%',
          overflow: 'auto'
        }}
      >
        {renderStage()}
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  const handleExitAdmin = () => {
    setShowAdmin(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CollegeBot
          </Typography>
          {!showAdmin && (
            <Button
              color="inherit"
              startIcon={<SettingsIcon />}
              onClick={() => setShowAdmin(true)}
              sx={{ mr: 2 }}
            >
              {isAdmin ? "Admin" : "Settings"}
            </Button>
          )}
          <Login />
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {showAdmin ? (
          <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
            <AdminPanel onBack={handleExitAdmin} />
          </Container>
        ) : (
          <WizardContent />
        )}
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <SidebarProvider>
          <WizardProvider>
            <ChatProvider>
              <CalendarProvider>
                <AppContent />
              </CalendarProvider>
            </ChatProvider>
          </WizardProvider>
        </SidebarProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;
