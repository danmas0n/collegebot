import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Divider,
  Button,
  Chip,
  Alert,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  AttachMoney as BudgetIcon,
  Storage as DataIcon,
  Recommend as RecommendIcon,
  Map as MapIcon,
  Event as PlanIcon,
  ArrowBack as BackIcon,
  ArrowForward as ForwardIcon,
  Chat as ChatIcon,
  TipsAndUpdates as TipsIcon,
  Block as BlockIcon,
  Autorenew as AutorenewIcon,
  ExitToApp as ExitIcon,
} from '@mui/icons-material';
import { useWizard } from '../contexts/WizardContext';
import { WizardStage } from '../types/wizard';
import { useSidebar } from '../App';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

const STAGE_CONFIG: Record<WizardStage, {
  label: string;
  icon: React.ReactElement;
  tabs?: { label: string; icon: React.ReactElement; key: string }[];
}> = {
  'student-selection': {
    label: 'Select Student',
    icon: <PersonIcon />,
  },
  'student-profile': {
    label: 'Student Profile',
    icon: <PersonIcon />,
  },
  'college-interests': {
    label: 'Interests',
    icon: <SchoolIcon />,
  },
  'budget': {
    label: 'Budget',
    icon: <BudgetIcon />,
  },
  'data-collection': {
    label: 'Data Collection',
    icon: <DataIcon />,
  },
  'recommendations': {
    label: 'Recommendations',
    icon: <RecommendIcon />,
  },
  'map': {
    label: 'Map',
    icon: <MapIcon />,
  },
  'calendar': {
    label: 'Plan',
    icon: <PlanIcon />,
  },
};

interface NavigationSidebarProps {}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  
  // Auto-collapse after 10 seconds when expanded
  useEffect(() => {
    if (!isCollapsed && !isMobile) {
      const timer = setTimeout(() => {
        setIsCollapsed(true);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isCollapsed, isMobile, lastInteraction]);
  
  const {
    currentStage,
    goToStage,
    nextStage,
    previousStage,
    currentStudent,
    isNavigationBlocked,
    activeLLMOperations,
  } = useWizard();

  const stages = [
    ...Object.entries(STAGE_CONFIG)
      .filter(([stage]) => stage !== 'student-selection')
      .map(([stage, config]) => ({
        stage: stage as WizardStage,
        ...config,
      })),
    { stage: 'student-selection' as WizardStage, label: 'Exit', icon: <ExitIcon /> }
  ];

  const currentIndex = stages.findIndex(stage => stage.stage === currentStage);
  const currentStageConfig = STAGE_CONFIG[currentStage];

  const resetTimer = () => {
    setLastInteraction(Date.now());
  };

  const handleStageClick = (stage: WizardStage) => {
    resetTimer();
    if (!isNavigationBlocked) {
      goToStage(stage);
    }
  };

  const handleToggleCollapse = () => {
    resetTimer();
    setIsCollapsed(!isCollapsed);
  };

  const handlePreviousStage = () => {
    resetTimer();
    previousStage();
  };

  const handleNextStage = () => {
    resetTimer();
    nextStage();
  };



  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        minHeight: 64,
      }}>
        {!isCollapsed && (
          <Typography variant="h6" noWrap>
            {currentStudent?.name || 'Navigation'}
          </Typography>
        )}
        <IconButton onClick={handleToggleCollapse}>
          {isCollapsed ? <MenuIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Blocked Alert */}
      {isNavigationBlocked && activeLLMOperations.length > 0 && !isCollapsed && (
        <Box sx={{ p: 2 }}>
          <Alert 
            severity="info" 
            icon={<AutorenewIcon />}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              Navigation blocked:
            </Typography>
            {activeLLMOperations.map((operation) => (
              <Chip
                key={operation.id}
                label={operation.description}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Alert>
        </Box>
      )}

      {/* Stage Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List>
          {stages.map(({ stage, label, icon }, index) => {
            const isActive = stage === currentStage;
            const isCompleted = index < currentIndex;
            const isDisabled = isNavigationBlocked;

            return (
              <ListItem key={stage} disablePadding>
                <Tooltip 
                  title={isCollapsed ? label : ''} 
                  placement="right"
                  arrow
                >
                  <ListItemButton
                    selected={isActive}
                    onClick={() => handleStageClick(stage)}
                    disabled={isDisabled}
                    sx={{
                      minHeight: 48,
                      justifyContent: isCollapsed ? 'center' : 'initial',
                      px: 2.5,
                      opacity: isDisabled ? 0.6 : 1,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: isCollapsed ? 0 : 3,
                        justifyContent: 'center',
                        color: isActive ? 'primary.main' : 
                               isCompleted ? 'success.main' : 'inherit',
                      }}
                    >
                      {isDisabled ? <BlockIcon /> : icon}
                    </ListItemIcon>
                    {!isCollapsed && (
                      <ListItemText 
                        primary={label}
                        sx={{
                          '& .MuiListItemText-primary': {
                            color: isActive ? 'primary.main' : 'inherit',
                            fontWeight: isActive ? 600 : 400,
                          }
                        }}
                      />
                    )}
                    {!isCollapsed && isCompleted && (
                      <Box sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: 'success.main' 
                      }} />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        {/* Stage-specific Tabs */}

      </Box>

      <Divider />

      {/* Navigation Controls */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', gap: 1 }}>
          <Tooltip title={isCollapsed ? 'Back' : ''} placement="right" arrow>
            <span>
              <Button
                variant="outlined"
                onClick={handlePreviousStage}
                disabled={currentIndex === 0 || isNavigationBlocked}
                startIcon={!isCollapsed ? <BackIcon /> : undefined}
                size="small"
                sx={{ 
                  minWidth: isCollapsed ? 40 : 'auto',
                  px: isCollapsed ? 1 : 2,
                }}
              >
                {isCollapsed ? <BackIcon /> : 'Back'}
              </Button>
            </span>
          </Tooltip>

          <Tooltip title={isCollapsed ? 'Next' : ''} placement="right" arrow>
            <span>
              <Button
                variant="contained"
                onClick={handleNextStage}
                disabled={currentIndex === stages.length - 1 || isNavigationBlocked}
                startIcon={!isCollapsed ? <ForwardIcon /> : undefined}
                size="small"
                sx={{ 
                  minWidth: isCollapsed ? 40 : 'auto',
                  px: isCollapsed ? 1 : 2,
                }}
              >
                {isCollapsed ? <ForwardIcon /> : 'Next'}
              </Button>
            </span>
          </Tooltip>
        </Box>


      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={!isCollapsed}
        onClose={() => setIsCollapsed(true)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
          boxSizing: 'border-box',
          top: 64, // Position below AppBar
          height: 'calc(100vh - 64px)', // Adjust height to account for AppBar
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};
