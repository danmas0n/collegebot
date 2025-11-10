import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Link
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import { MapLocation } from '../../types/wizard';

interface FinancialDataDialogProps {
  open: boolean;
  location: MapLocation | null;
  onClose: () => void;
  onSave: (locationId: string, financialData: any, notes: string) => void;
}

export const FinancialDataDialog = ({
  open,
  location,
  onClose,
  onSave
}: FinancialDataDialogProps) => {
  const [costOfAttendance, setCostOfAttendance] = useState('');
  const [netPriceEstimate, setNetPriceEstimate] = useState('');
  const [netPriceSource, setNetPriceSource] = useState<'npc' | 'estimate' | 'cds'>('estimate');
  const [netPriceNotes, setNetPriceNotes] = useState('');
  const [notes, setNotes] = useState('');

  // Initialize form when location changes
  useState(() => {
    if (location) {
      const financial = location.metadata?.financial;
      setCostOfAttendance(financial?.costOfAttendance?.toString() || '');
      setNetPriceEstimate(financial?.netPriceEstimate?.toString() || '');
      setNetPriceSource(financial?.netPriceSource || 'estimate');
      setNetPriceNotes(financial?.netPriceNotes || '');
      setNotes(location.metadata?.notes || '');
    }
  });

  const handleSave = () => {
    if (!location) return;

    const financialData = {
      costOfAttendance: costOfAttendance ? parseFloat(costOfAttendance) : undefined,
      netPriceEstimate: netPriceEstimate ? parseFloat(netPriceEstimate) : undefined,
      netPriceSource,
      netPriceNotes: netPriceNotes || undefined
    };

    onSave(location.id, financialData, notes);
    onClose();
  };

  if (!location) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Financial Data: {location.name}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Need help estimating costs?</strong> Use the federal Net Price Calculator to get an estimate based on your family's financial situation.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalculateIcon />}
              onClick={() => window.open('https://collegecost.ed.gov/net-price', '_blank')}
              sx={{ mt: 1 }}
            >
              Open Net Price Calculator
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Note: NPCs typically show need-based aid only. Merit aid (assessed separately by our AI) can further reduce your cost.
            </Typography>
          </Alert>

          {/* Merit Aid Assessment */}
          {location.metadata?.financial?.meritAidLikelihood && (
            <Alert 
              severity={
                location.metadata.financial.meritAidLikelihood === 'high' ? 'success' :
                location.metadata.financial.meritAidLikelihood === 'medium' ? 'info' :
                location.metadata.financial.meritAidLikelihood === 'low' ? 'warning' : 'error'
              }
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Merit Aid Likelihood: {location.metadata.financial.meritAidLikelihood.charAt(0).toUpperCase() + location.metadata.financial.meritAidLikelihood.slice(1)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {location.metadata.financial.meritAidReasoning}
              </Typography>
            </Alert>
          )}

          <TextField
            fullWidth
            label="Cost of Attendance (Annual)"
            type="number"
            value={costOfAttendance}
            onChange={(e) => setCostOfAttendance(e.target.value)}
            InputProps={{
              startAdornment: <span style={{ marginRight: 8 }}>$</span>
            }}
            helperText="Total annual cost including tuition, room, board, fees"
          />

          <TextField
            fullWidth
            label="Estimated Net Price (Annual)"
            type="number"
            value={netPriceEstimate}
            onChange={(e) => setNetPriceEstimate(e.target.value)}
            InputProps={{
              startAdornment: <span style={{ marginRight: 8 }}>$</span>
            }}
            helperText="Your estimated out-of-pocket cost after aid"
          />

          <FormControl fullWidth>
            <InputLabel>Net Price Source</InputLabel>
            <Select
              value={netPriceSource}
              label="Net Price Source"
              onChange={(e) => setNetPriceSource(e.target.value as 'npc' | 'estimate' | 'cds')}
            >
              <MenuItem value="npc">Net Price Calculator</MenuItem>
              <MenuItem value="estimate">Personal Estimate</MenuItem>
              <MenuItem value="cds">CDS Data</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Net Price Notes"
            multiline
            rows={2}
            value={netPriceNotes}
            onChange={(e) => setNetPriceNotes(e.target.value)}
            placeholder="e.g., Based on NPC with $80k income, includes merit scholarship..."
          />

          <TextField
            fullWidth
            label="General Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this college..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
