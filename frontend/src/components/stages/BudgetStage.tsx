import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  FormControlLabel,
  Checkbox,
  Grid,
  InputAdornment,
  Slider,
  FormGroup
} from '@mui/material';
import { useWizard } from '../../contexts/WizardContext';
import { BudgetInfo } from '../../types/wizard';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};

export const BudgetStage: React.FC = () => {
  const { data, updateData } = useWizard();

  const handleBudgetUpdate = (field: keyof BudgetInfo, value: any) => {
    updateData({
      budgetInfo: {
        ...data.budgetInfo,
        [field]: value
      }
    });
  };

  const handleWillingnessUpdate = (field: keyof Required<BudgetInfo>['willingness'], checked: boolean) => {
    handleBudgetUpdate('willingness', {
      ...data.budgetInfo.willingness,
      [field]: checked
    });
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Budget Planning
      </Typography>
      <Typography color="text.secondary" paragraph>
        Help us understand your financial situation to find colleges and opportunities within your budget.
      </Typography>

      <Box sx={{ mb: 6 }}>
        <Typography variant="h6" gutterBottom>
          Yearly Budget
        </Typography>
        <Typography color="text.secondary" gutterBottom>
          How much can you afford to spend per year on college?
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Yearly Budget"
              type="number"
              value={data.budgetInfo.yearlyBudget || ''}
              onChange={e => handleBudgetUpdate('yearlyBudget', parseInt(e.target.value) || undefined)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                inputProps: { min: 0, step: 1000 }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ px: 2 }}>
              <Slider
                value={data.budgetInfo.yearlyBudget || 0}
                onChange={(_, value) => handleBudgetUpdate('yearlyBudget', value)}
                min={0}
                max={100000}
                step={1000}
                marks={[
                  { value: 0, label: '$0' },
                  { value: 25000, label: '$25k' },
                  { value: 50000, label: '$50k' },
                  { value: 75000, label: '$75k' },
                  { value: 100000, label: '$100k' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={formatCurrency}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>
          Financial Aid Options
        </Typography>
        <Typography color="text.secondary" gutterBottom>
          Select which types of financial aid you're willing to consider:
        </Typography>
        
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={data.budgetInfo.willingness?.loans || false}
                onChange={e => handleWillingnessUpdate('loans', e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography>Student Loans</Typography>
                <Typography variant="body2" color="text.secondary">
                  Borrowed money that must be repaid with interest
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={data.budgetInfo.willingness?.workStudy || false}
                onChange={e => handleWillingnessUpdate('workStudy', e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography>Work-Study Programs</Typography>
                <Typography variant="body2" color="text.secondary">
                  Part-time work opportunities to earn money for college expenses
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={data.budgetInfo.willingness?.scholarships || false}
                onChange={e => handleWillingnessUpdate('scholarships', e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography>Scholarships & Grants</Typography>
                <Typography variant="body2" color="text.secondary">
                  Financial aid that doesn't need to be repaid
                </Typography>
              </Box>
            }
          />
        </FormGroup>
      </Box>
    </Paper>
  );
};
