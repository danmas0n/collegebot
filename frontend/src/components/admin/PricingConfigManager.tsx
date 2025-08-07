import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { costTrackingApi } from '../../utils/api';
import { LLMPricingConfig } from '../../types/cost-tracking';

interface PricingConfigManagerProps {}

export const PricingConfigManager: React.FC<PricingConfigManagerProps> = () => {
  const [configs, setConfigs] = useState<LLMPricingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<LLMPricingConfig> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await costTrackingApi.getPricingConfig();
      setConfigs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing configuration');
      console.error('Error loading pricing configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      setSaving(true);
      await costTrackingApi.initializeDefaultPricing();
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize default pricing');
      console.error('Error initializing defaults:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (config: LLMPricingConfig) => {
    setEditingConfig(config);
    setEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingConfig({
      provider: 'claude',
      model: '',
      pricing: {
        inputTokensPerMillion: 0,
        outputTokensPerMillion: 0,
        cacheCreationInputTokensPerMillion: 0,
        cacheReadInputTokensPerMillion: 0,
      },
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    try {
      setSaving(true);
      const configsToUpdate = editingConfig.id 
        ? configs.map(c => c.id === editingConfig.id ? editingConfig as LLMPricingConfig : c)
        : [...configs, editingConfig as LLMPricingConfig];
      
      await costTrackingApi.updatePricingConfig(configsToUpdate);
      await loadConfigs();
      setEditDialogOpen(false);
      setEditingConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing configuration');
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setEditDialogOpen(false);
    setEditingConfig(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  };

  const formatDate = (date: Date | string | any) => {
    if (!date) return 'Never';
    
    // Handle Firestore timestamp or string
    let dateObj: Date;
    if (date && typeof date === 'object' && date.toDate) {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'Invalid Date';
    }
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatUserName = (userId: string) => {
    if (!userId) return 'Unknown';
    
    // If it looks like an email, show just the part before @
    if (userId.includes('@')) {
      return userId.split('@')[0];
    }
    
    // If it's a long Firebase UID, show first 8 characters
    if (userId.length > 20) {
      return `${userId.substring(0, 8)}...`;
    }
    
    return userId;
  };

  const getProviderColor = (provider: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' } = {
      claude: 'primary',
      gemini: 'success',
      openai: 'secondary',
    };
    return colors[provider] || 'default';
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">LLM Pricing Configuration</Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadConfigs}
            variant="outlined"
            size="small"
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAdd}
            variant="outlined"
            size="small"
            sx={{ mr: 1 }}
          >
            Add Config
          </Button>
          <Button
            onClick={initializeDefaults}
            variant="contained"
            size="small"
            disabled={saving}
          >
            Initialize Defaults
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Model</TableCell>
                <TableCell>Input Tokens</TableCell>
                <TableCell>Output Tokens</TableCell>
                <TableCell>Cache Creation</TableCell>
                <TableCell>Cache Read</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id} hover>
                  <TableCell>
                    <Chip
                      label={config.provider}
                      size="small"
                      color={getProviderColor(config.provider)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {config.model}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatCurrency(config.pricing.inputTokensPerMillion)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      per 1M tokens
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatCurrency(config.pricing.outputTokensPerMillion)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      per 1M tokens
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {config.pricing.cacheCreationInputTokensPerMillion ? (
                      <>
                        <Typography variant="body2">
                          {formatCurrency(config.pricing.cacheCreationInputTokensPerMillion)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          per 1M tokens
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {config.pricing.cacheReadInputTokensPerMillion ? (
                      <>
                        <Typography variant="body2">
                          {formatCurrency(config.pricing.cacheReadInputTokensPerMillion)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          per 1M tokens
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {formatDate(config.updatedAt)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      by {formatUserName(config.updatedBy)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(config)}>
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary" py={3}>
                      No pricing configurations found. Click "Initialize Defaults" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingConfig?.id ? 'Edit Pricing Configuration' : 'Add Pricing Configuration'}
        </DialogTitle>
        <DialogContent>
          {editingConfig && (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Provider"
                value={editingConfig.provider || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, provider: e.target.value as any })}
                margin="normal"
                select
                SelectProps={{ native: true }}
              >
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </TextField>
              
              <TextField
                fullWidth
                label="Model"
                value={editingConfig.model || ''}
                onChange={(e) => setEditingConfig({ ...editingConfig, model: e.target.value })}
                margin="normal"
                placeholder="e.g., claude-3-5-sonnet-20241022"
              />

              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Pricing (per million tokens)
              </Typography>

              <TextField
                fullWidth
                label="Input Tokens Price"
                type="number"
                value={editingConfig.pricing?.inputTokensPerMillion || ''}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  pricing: {
                    ...editingConfig.pricing!,
                    inputTokensPerMillion: parseFloat(e.target.value) || 0
                  }
                })}
                margin="normal"
                inputProps={{ step: 0.01, min: 0 }}
              />

              <TextField
                fullWidth
                label="Output Tokens Price"
                type="number"
                value={editingConfig.pricing?.outputTokensPerMillion || ''}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  pricing: {
                    ...editingConfig.pricing!,
                    outputTokensPerMillion: parseFloat(e.target.value) || 0
                  }
                })}
                margin="normal"
                inputProps={{ step: 0.01, min: 0 }}
              />

              <TextField
                fullWidth
                label="Cache Creation Price (optional)"
                type="number"
                value={editingConfig.pricing?.cacheCreationInputTokensPerMillion || ''}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  pricing: {
                    ...editingConfig.pricing!,
                    cacheCreationInputTokensPerMillion: parseFloat(e.target.value) || 0
                  }
                })}
                margin="normal"
                inputProps={{ step: 0.01, min: 0 }}
              />

              <TextField
                fullWidth
                label="Cache Read Price (optional)"
                type="number"
                value={editingConfig.pricing?.cacheReadInputTokensPerMillion || ''}
                onChange={(e) => setEditingConfig({
                  ...editingConfig,
                  pricing: {
                    ...editingConfig.pricing!,
                    cacheReadInputTokensPerMillion: parseFloat(e.target.value) || 0
                  }
                })}
                margin="normal"
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={saving || !editingConfig?.model || !editingConfig?.provider}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
