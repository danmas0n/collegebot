import { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Tooltip
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import { MapLocation } from '../../types/wizard';

interface CollegeEditDialogProps {
  open: boolean;
  location: MapLocation | null;
  onClose: () => void;
  onSave: (locationId: string, updates: Partial<MapLocation>) => void;
  onGeocodeAddress?: (address: string) => Promise<{ lat: number; lng: number; formattedAddress: string } | null>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`college-edit-tabpanel-${index}`}
      aria-labelledby={`college-edit-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const CollegeEditDialog = ({
  open,
  location,
  onClose,
  onSave,
  onGeocodeAddress
}: CollegeEditDialogProps) => {
  const [tabValue, setTabValue] = useState(0);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<string>('uncategorized');
  const [address, setAddress] = useState('');
  const [costOfAttendance, setCostOfAttendance] = useState('');
  const [netPriceEstimate, setNetPriceEstimate] = useState('');
  const [netPriceSource, setNetPriceSource] = useState<'npc' | 'estimate' | 'cds'>('estimate');
  const [netPriceNotes, setNetPriceNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);

  // Initialize form when location changes
  useEffect(() => {
    if (location) {
      setName(location.name || '');
      setTier(location.tier || 'uncategorized');
      setAddress(location.metadata?.address || '');
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      
      const financial = location.metadata?.financial;
      setCostOfAttendance(financial?.costOfAttendance?.toString() || '');
      setNetPriceEstimate(financial?.netPriceEstimate?.toString() || '');
      setNetPriceSource(financial?.netPriceSource || 'estimate');
      setNetPriceNotes(financial?.netPriceNotes || '');
      setNotes(location.metadata?.notes || '');
    }
  }, [location]);

  const handleGeocodeAddress = async () => {
    if (!address.trim() || !onGeocodeAddress) return;
    
    try {
      setIsGeocoding(true);
      setGeocodeError('');
      
      const result = await onGeocodeAddress(address);
      
      if (result) {
        setLatitude(result.lat);
        setLongitude(result.lng);
        setAddress(result.formattedAddress);
      } else {
        setGeocodeError('No results found for this address');
      }
    } catch (err) {
      setGeocodeError('Failed to find location. Please check the address and try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = () => {
    if (!location) return;

    const updates: Partial<MapLocation> = {
      name,
      tier: tier as any,
      latitude,
      longitude,
      metadata: {
        ...location.metadata,
        address,
        notes,
        financial: {
          ...location.metadata?.financial,
          costOfAttendance: costOfAttendance ? parseFloat(costOfAttendance) : undefined,
          netPriceEstimate: netPriceEstimate ? parseFloat(netPriceEstimate) : undefined,
          netPriceSource,
          netPriceNotes: netPriceNotes || undefined
        }
      }
    };

    onSave(location.id, updates);
    onClose();
  };

  if (!location) return null;

  const meritAidLikelihood = location.metadata?.financial?.meritAidLikelihood;
  const meritAidReasoning = location.metadata?.financial?.meritAidReasoning;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit College: {location.name}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Basic Info" />
          <Tab label="Financial" />
          <Tab label="Notes" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="School Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="The name of the college or university"
            />

            <FormControl fullWidth>
              <InputLabel>Tier</InputLabel>
              <Select
                value={tier}
                label="Tier"
                onChange={(e) => setTier(e.target.value)}
              >
                <MenuItem value="reach">Reach</MenuItem>
                <MenuItem value="target">Target</MenuItem>
                <MenuItem value="safety">Safety</MenuItem>
                <MenuItem value="likely">Likely</MenuItem>
                <MenuItem value="uncategorized">Uncategorized</MenuItem>
              </Select>
            </FormControl>

            {(location.metadata?.description || location.metadata?.reason) && (
              <Alert severity="success" icon={false}>
                <Typography variant="body2">
                  <strong>Why it's a good fit:</strong> {location.metadata?.description || location.metadata?.reason}
                </Typography>
              </Alert>
            )}

            {location.tierReasoning && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>AI Tier Reasoning:</strong> {location.tierReasoning}
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={!!geocodeError}
                helperText={geocodeError || 'Enter the full address (e.g., "Harvard University, Cambridge, MA")'}
                placeholder="e.g., Harvard University, Cambridge, MA"
              />
              {onGeocodeAddress && (
                <Button
                  variant="outlined"
                  onClick={handleGeocodeAddress}
                  disabled={!address.trim() || isGeocoding}
                  sx={{ minWidth: '120px' }}
                >
                  {isGeocoding ? <CircularProgress size={20} /> : 'Find Location'}
                </Button>
              )}
            </Box>

            {latitude !== 0 && longitude !== 0 && (
              <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="body2" color="success.dark">
                  ✓ Location: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
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

            {meritAidLikelihood && (
              <Alert 
                severity={
                  meritAidLikelihood === 'high' ? 'success' :
                  meritAidLikelihood === 'medium' ? 'info' :
                  meritAidLikelihood === 'low' ? 'warning' : 'error'
                }
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  Merit Aid Likelihood: {meritAidLikelihood.charAt(0).toUpperCase() + meritAidLikelihood.slice(1)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {meritAidReasoning}
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
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this college..."
          />
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
