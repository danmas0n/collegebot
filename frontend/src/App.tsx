import React, { useState, useContext, createContext, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import FeedbackIcon from '@mui/icons-material/Feedback';
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
import { initGA, trackPageView, trackWizardStageEntered, trackUserLogin, trackUserLogout } from './utils/analytics';

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

  // Track stage changes
  React.useEffect(() => {
    if (currentStage && currentUser && isWhitelisted) {
      trackWizardStageEntered(currentStage, currentStudent?.id);
      trackPageView(`/${currentStage}`, `${currentStage.charAt(0).toUpperCase() + currentStage.slice(1)} Stage`);
    }
  }, [currentStage, currentStudent?.id, currentUser, isWhitelisted]);

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
  const [showAbout, setShowAbout] = useState(false);

  const handleExitAdmin = () => {
    setShowAdmin(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Counseled
          </Typography>
          {!showAdmin && (
            <>
              <Button
                color="inherit"
                startIcon={<InfoIcon />}
                onClick={() => setShowAbout(true)}
                sx={{ mr: 2 }}
              >
                About
              </Button>
              <Button
                color="inherit"
                startIcon={<FeedbackIcon />}
                component="a"
                href="mailto:sorghum.twerp_4z@icloud.com?subject=Feedback on Counseled"
                sx={{ mr: 2 }}
              >
                Feedback
              </Button>
              <Button
                color="inherit"
                startIcon={<SettingsIcon />}
                onClick={() => setShowAdmin(true)}
                sx={{ mr: 2 }}
              >
                {isAdmin ? "Admin" : "Settings"}
              </Button>
            </>
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

      {/* About Modal */}
      <Dialog
        open={showAbout}
        onClose={() => setShowAbout(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          <InfoIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" component="div">
            About Counseled
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            Your AI-Powered College Planning Companion
          </Typography>
          <Typography variant="body1" paragraph>
            Counseled is a comprehensive college planning platform that guides students and families 
            through every step of the college admissions journey. From initial exploration to final 
            decisions, we provide personalized guidance powered by artificial intelligence.
          </Typography>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3, color: 'primary.main' }}>
            What Counseled Does:
          </Typography>
          <Box component="ul" sx={{ pl: 3 }}>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>Student Profiling:</strong> Build comprehensive profiles including academic achievements, 
              interests, and goals
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>College Discovery:</strong> Find colleges that match your preferences, budget, and academic profile
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>Budget Planning:</strong> Understand costs and explore financial aid options
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>AI-Powered Recommendations:</strong> Get personalized college suggestions based on your unique profile
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>Interactive Maps:</strong> Visualize college locations and plan campus visits
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>Timeline Planning:</strong> Stay organized with personalized application timelines
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 1 }}>
              <strong>Family Collaboration:</strong> Share progress and collaborate with family members and counselors
            </Typography>
          </Box>
          
          <Typography variant="body1" paragraph sx={{ mt: 3 }}>
            Our mission is to make college planning accessible, organized, and stress-free for every family. 
            Whether you're just starting to explore options or finalizing your college list, Counseled 
            provides the tools and insights you need to make informed decisions about your future.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            onClick={() => setShowAbout(false)}
            variant="contained"
            color="primary"
            size="large"
          >
            Get Started
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const App: React.FC = () => {
  // Initialize Google Analytics
  useEffect(() => {
    initGA();
  }, []);

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
