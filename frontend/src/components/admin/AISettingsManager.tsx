import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

interface AISettings {
  id: string;
  serviceType: 'claude' | 'gemini';
  model: string;
  claudeModel?: string;
  geminiModel?: string;
  claudeApiKey?: string;
  geminiApiKey?: string;
  updatedAt: string;
  updatedBy: string;
}

const defaultSettings: AISettings = {
  id: 'current',
  serviceType: 'claude',
  model: 'claude-3-5-sonnet-20241022',
  claudeModel: 'claude-3-5-sonnet-20241022',
  geminiModel: 'gemini-2.0-flash',
  claudeApiKey: '',
  geminiApiKey: '',
  updatedAt: new Date().toISOString(),
  updatedBy: ''
};

export const AISettingsManager = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<AISettings>({
    ...defaultSettings,
    claudeModel: 'claude-3-5-sonnet-20241022',
    geminiModel: 'gemini-2.0-flash'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/api/admin/ai-settings');
        if (!response.ok) {
          throw new Error('Failed to fetch AI settings');
        }
        const data = await response.json();
        setSettings(data);
      } catch (err) {
        console.error('Error fetching AI settings:', err);
        setError('Failed to load AI settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.post('/api/admin/ai-settings', {
        settings: {
          ...settings,
          updatedBy: currentUser?.email || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to save AI settings');
      }

      setSuccess('Settings saved successfully');
    } catch (err) {
      console.error('Error saving AI settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        AI Service Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
        <FormControl fullWidth>
          <InputLabel>Service Type</InputLabel>
          <Select
            value={settings.serviceType}
            label="Service Type"
            onChange={(e) => {
              const newType = e.target.value as 'claude' | 'gemini';
              setSettings({
                ...settings,
                serviceType: newType,
                model: newType === 'claude' ? settings.claudeModel || settings.model : settings.geminiModel || settings.model
              });
            }}
          >
            <MenuItem value="claude">Claude</MenuItem>
            <MenuItem value="gemini">Gemini</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Model"
          value={settings.model}
          onChange={(e) => {
            const newModel = e.target.value;
            setSettings({
              ...settings,
              model: newModel,
              ...(settings.serviceType === 'claude' 
                ? { claudeModel: newModel }
                : { geminiModel: newModel })
            });
          }}
          helperText={
            settings.serviceType === 'claude' 
              ? 'e.g., claude-3-5-sonnet-20241022' 
              : 'e.g., gemini-2.0-flash'
          }
        />

        <TextField
          fullWidth
          type="password"
          label="Claude API Key"
          value={settings.claudeApiKey || ''}
          onChange={(e) => setSettings({
            ...settings,
            claudeApiKey: e.target.value
          })}
          disabled={settings.serviceType !== 'claude'}
        />

        <TextField
          fullWidth
          type="password"
          label="Gemini API Key"
          value={settings.geminiApiKey || ''}
          onChange={(e) => setSettings({
            ...settings,
            geminiApiKey: e.target.value
          })}
          disabled={settings.serviceType !== 'gemini'}
        />

        {settings.updatedBy && (
          <Typography variant="body2" color="text.secondary">
            Last updated by {settings.updatedBy} at {new Date(settings.updatedAt).toLocaleString()}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
