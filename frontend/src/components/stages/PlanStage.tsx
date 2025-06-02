import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Tabs,
  Tab,
  Button
} from '@mui/material';
import {
  AutoAwesome as AIIcon
} from '@mui/icons-material';
import { useWizard } from '../../contexts/WizardContext';
import { PlanOverview } from '../plan/PlanOverview';
import { AIPlanBuilder } from '../plan/AIPlanBuilder';
import { Plan } from '../../types/plan';
import CalendarView from '../calendar/CalendarView';
import TipsAdvicePanel from '../calendar/TipsAdvicePanel';
import PinSelector from '../calendar/PinSelector';
import { PinResearchPanel } from '../plan/PinResearchPanel';
import { useCalendar } from '../../contexts/CalendarContext';
import { StageContainer, StageHeader } from './StageContainer';
import { MapLocation } from '../../types/wizard';
import { api } from '../../utils/api';

interface PlanStageProps {
  studentId?: string;
}

export const PlanStage: React.FC<PlanStageProps> = ({ studentId }) => {
  const { currentStudent, data } = useWizard();
  const { startPinResearch } = useCalendar();
  
  const [activeTab, setActiveTab] = useState<number>(0); // Default to Research tab
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [selectedPinNames, setSelectedPinNames] = useState<string[]>([]);
  const [showAIPlanBuilder, setShowAIPlanBuilder] = useState<boolean>(false);
  
  // Use the studentId from props if provided, otherwise use the currentStudent's id
  const effectiveStudentId = studentId || currentStudent?.id;
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Handle plan selection
  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    // Switch to the plan details tab
    setActiveTab(2);
  };

  // Handle plan updates from AI Plan Builder
  const handlePlanUpdated = (updatedPlan: Plan) => {
    setSelectedPlan(updatedPlan);
    setShowAIPlanBuilder(false);
  };
  
  // Handle pin selection for research
  const handlePinSelection = async (pinIds: string[]) => {
    if (!effectiveStudentId || pinIds.length === 0) return;
    
    try {
      // Load locations from API to get the most current data
      const response = await api.post('/api/students/map-locations/get', {
        studentId: effectiveStudentId
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load locations: ${response.status}`);
      }
      
      const locations: MapLocation[] = await response.json();
      console.log('Loaded locations for name resolution:', locations.map((loc: MapLocation) => ({ id: loc.id, name: loc.name })));
      console.log('Selected pin IDs:', pinIds);
      
      const pinNames = pinIds.map(pinId => {
        const location = locations.find((loc: MapLocation) => loc.id === pinId);
        console.log(`Resolving pin ${pinId}:`, location ? location.name : 'NOT FOUND');
        return location ? location.name : `Unknown College (${pinId})`;
      });
      
      console.log('Resolved pin names:', pinNames);
      
      setSelectedPinIds(pinIds);
      setSelectedPinNames(pinNames);
      
      // Switch to the research tab
      setActiveTab(0);
    } catch (error) {
      console.error('Error loading locations for name resolution:', error);
      // Fallback to using the pin IDs as names
      setSelectedPinIds(pinIds);
      setSelectedPinNames(pinIds.map(id => `College ${id.slice(-8)}`)); // Use last 8 chars of ID
      setActiveTab(0);
    }
  };
  
  // Handle research completion
  const handleResearchComplete = () => {
    console.log('Research completed, refreshing plans...');
    // The plan should now be available in PlanOverview
    // Switch to Plans Overview tab to see the new plan
    setActiveTab(1);
  };
  
  // Handle research error
  const handleResearchError = (error: string) => {
    console.error('Research error:', error);
  };
  
  return (
    <StageContainer data-testid="plan-stage">
      <StageHeader>
        <Typography variant="h5">
          Plan
        </Typography>
      </StageHeader>
      
      {effectiveStudentId ? (
        <Box sx={{ 
          width: '100%', 
          maxWidth: '100%',
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              aria-label="plan tabs"
            >
              <Tab label="Research" />
              <Tab label="Plans Overview" />
              <Tab label="Plan Details" disabled={!selectedPlan} />
              <Tab label="Tips & Advice" />
            </Tabs>
          </Box>
          
          {/* Research Tab */}
          <Box role="tabpanel" hidden={activeTab !== 0} sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {activeTab === 0 && (
              <Box>
                {selectedPinIds.length > 0 ? (
                  <PinResearchPanel
                    pinIds={selectedPinIds}
                    pinNames={selectedPinNames}
                    onResearchComplete={handleResearchComplete}
                    onResearchError={handleResearchError}
                  />
                ) : (
                  <PinSelector 
                    onStartResearch={handlePinSelection}
                  />
                )}
              </Box>
            )}
          </Box>
          
          {/* Plans Overview Tab */}
          <Box role="tabpanel" hidden={activeTab !== 1} sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {activeTab === 1 && (
              <PlanOverview onPlanSelect={handlePlanSelect} />
            )}
          </Box>
          
          {/* Plan Details Tab */}
          <Box role="tabpanel" hidden={activeTab !== 2} sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {activeTab === 2 && selectedPlan && (
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    {selectedPlan.schoolName} Plan
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AIIcon />}
                    onClick={() => setShowAIPlanBuilder(true)}
                    sx={{ ml: 2 }}
                  >
                    AI Plan Builder
                  </Button>
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  Status: {selectedPlan.status.charAt(0).toUpperCase() + selectedPlan.status.slice(1)}
                </Typography>
                {selectedPlan.description && (
                  <Typography variant="body1" paragraph>
                    {selectedPlan.description}
                  </Typography>
                )}
                
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Timeline ({selectedPlan.timeline.length} tasks)
                </Typography>
                
                {selectedPlan.timeline.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      No tasks yet. Use the AI Plan Builder to create a customized timeline for this plan.
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AIIcon />}
                      onClick={() => setShowAIPlanBuilder(true)}
                    >
                      Get Started with AI Plan Builder
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {selectedPlan.timeline.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Due: {new Date(item.dueDate).toLocaleDateString()} • Priority: {item.priority}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Paper>
            )}
          </Box>
          
          {/* Tips & Advice Tab */}
          <Box role="tabpanel" hidden={activeTab !== 3} sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {activeTab === 3 && (
              <TipsAdvicePanel />
            )}
          </Box>
        </Box>
      ) : (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Please select a student to view their plans.
        </Typography>
      )}

      {/* AI Plan Builder Dialog */}
      {showAIPlanBuilder && selectedPlan && (
        <AIPlanBuilder
          plan={selectedPlan}
          onPlanUpdated={handlePlanUpdated}
          onClose={() => setShowAIPlanBuilder(false)}
        />
      )}
    </StageContainer>
  );
};
