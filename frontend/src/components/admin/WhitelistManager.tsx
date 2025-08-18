import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Button,
  Paper,
  Alert,
  Snackbar,
  Divider,
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthHeaders } from '../../utils/auth';

interface WhitelistedUser {
  email: string;
  userId: string;
  createdAt: any;
  createdBy: string;
  reason?: string;
}

interface AdminUser {
  email: string;
  role: string;
  createdAt: any;
}

interface WhitelistManagerProps {
  adminView: boolean;
}

export const WhitelistManager = ({ adminView }: WhitelistManagerProps) => {
  const { isAdmin, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  
  // Whitelist state
  const [whitelistedUsers, setWhitelistedUsers] = useState<WhitelistedUser[]>([]);
  const [sharedUsers, setSharedUsers] = useState<WhitelistedUser[]>([]);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [whitelistReason, setWhitelistReason] = useState('');
  
  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Family sharing state
  const [newFamilyEmail, setNewFamilyEmail] = useState('');
  
  // UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch whitelisted users
  const fetchWhitelistedUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const url = `${import.meta.env.VITE_API_URL}/api/admin/whitelisted-users`;
      console.log('Fetching whitelisted users from:', url);
      console.log('Headers:', headers);
      
      const response = await fetch(url, { headers });
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch whitelisted users: ${response.status} ${response.statusText}`);
      }
      
      const users = await response.json();
      console.log('Fetched whitelisted users:', users);
      setWhitelistedUsers(users);
    } catch (err) {
      console.error('Error fetching whitelisted users:', err);
      setError(`Failed to load whitelisted users: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Fetch admin users
  const fetchAdminUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const url = `${import.meta.env.VITE_API_URL}/api/admin/admin-users`;
      console.log('Fetching admin users from:', url);
      
      const response = await fetch(url, { headers });
      console.log('Admin users response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Admin users error response:', errorText);
        throw new Error(`Failed to fetch admin users: ${response.status} ${response.statusText}`);
      }
      
      const users = await response.json();
      console.log('Fetched admin users:', users);
      setAdminUsers(users);
    } catch (err) {
      console.error('Error fetching admin users:', err);
      setError(`Failed to load admin users: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Fetch shared users
  const fetchSharedUsers = async () => {
    try {
      const headers = await getAuthHeaders();
      const url = `${import.meta.env.VITE_API_URL}/api/admin/shared-users`;
      console.log('Fetching shared users from:', url);
      
      const response = await fetch(url, { headers });
      console.log('Shared users response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shared users error response:', errorText);
        throw new Error(`Failed to fetch shared users: ${response.status} ${response.statusText}`);
      }
      
      const users = await response.json();
      console.log('Fetched shared users:', users);
      setSharedUsers(users);
    } catch (err) {
      console.error('Error fetching shared users:', err);
      setError(`Failed to load shared users: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (adminView && isAdmin) {
      fetchWhitelistedUsers();
      fetchAdminUsers();
    }
    if (currentUser) {
      fetchSharedUsers();
    }
  }, [adminView, isAdmin, currentUser]);

  const handleAddWhitelistedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhitelistEmail.trim() || !isAdmin || !currentUser) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/whitelist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: newWhitelistEmail.trim().toLowerCase(),
          userId: '', // Will be set when they first sign in
          reason: whitelistReason.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      setNewWhitelistEmail('');
      setWhitelistReason('');
      setSuccess(`Added ${newWhitelistEmail} to whitelist`);
      await fetchWhitelistedUsers();
    } catch (err) {
      console.error('Error adding whitelisted user:', err);
      setError(err instanceof Error ? err.message : 'Failed to add user to whitelist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !isAdmin || !currentUser) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/admin-users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: newAdminEmail.trim().toLowerCase()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add admin');
      }

      setNewAdminEmail('');
      setSuccess(`Added ${newAdminEmail} as admin`);
      await fetchAdminUsers();
    } catch (err) {
      console.error('Error adding admin user:', err);
      setError(err instanceof Error ? err.message : 'Failed to add admin user');
    } finally {
      setLoading(false);
    }
  };

  const handleShareAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyEmail.trim() || !currentUser) return;

    if (sharedUsers.length >= 5) {
      setError('Maximum number of shared users (5) reached');
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: newFamilyEmail.trim().toLowerCase(),
          userId: '' // Will be set when they first sign in
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to share access');
      }

      setNewFamilyEmail('');
      setSuccess(`Shared access with ${newFamilyEmail}`);
      await fetchSharedUsers();
    } catch (err) {
      console.error('Error sharing access:', err);
      setError(err instanceof Error ? err.message : 'Failed to share access');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWhitelistedUser = async (email: string) => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/whitelist/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove user');
      }

      setSuccess(`Removed ${email} from whitelist`);
      await fetchWhitelistedUsers();
    } catch (err) {
      console.error('Error removing whitelisted user:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove user from whitelist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdminUser = async (email: string) => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/admin-users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove admin');
      }

      setSuccess(`Removed ${email} from admins`);
      await fetchAdminUsers();
    } catch (err) {
      console.error('Error removing admin user:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove admin user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSharedAccess = async (email: string) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/share/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove shared access');
      }

      setSuccess(`Removed shared access for ${email}`);
      await fetchSharedUsers();
    } catch (err) {
      console.error('Error removing shared access:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove shared access');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Date not available';
    
    // Handle Firestore Timestamp
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    
    // Handle regular Date
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString();
    }
    
    // Handle ISO string
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleDateString();
    }
    
    return 'Date not available';
  };

  if (!currentUser) {
    return (
      <Alert severity="error">
        You must be logged in to access this page.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {adminView && isAdmin && (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="Free Access Users" />
              <Tab label="Admin Users" />
              <Tab label="Family Access" />
            </Tabs>
          </Paper>

          {activeTab === 0 && (
            <>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Add Free Access User
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Grant free access to users without requiring a subscription
                </Typography>
                <form onSubmit={handleAddWhitelistedUser}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      value={newWhitelistEmail}
                      onChange={(e) => setNewWhitelistEmail(e.target.value)}
                      type="email"
                      required
                      size="small"
                    />
                    <TextField
                      fullWidth
                      label="Reason (optional)"
                      value={whitelistReason}
                      onChange={(e) => setWhitelistReason(e.target.value)}
                      placeholder="e.g., Beta tester, Partner, Special access"
                      size="small"
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<AddIcon />}
                      disabled={loading}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Add Free Access
                    </Button>
                  </Box>
                </form>
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Free Access Users ({whitelistedUsers.length})
                </Typography>
                <List>
                  {whitelistedUsers.map((user) => (
                    <ListItem key={user.email} divider>
                      <ListItemText
                        primary={user.email}
                        secondary={
                          <>
                            Added: {formatDate(user.createdAt)} by {user.createdBy}
                            {user.reason && (
                              <><br />Reason: {user.reason}</>
                            )}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRemoveWhitelistedUser(user.email)}
                          disabled={loading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                  {whitelistedUsers.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No free access users"
                        secondary="Users added here will have free access without needing a subscription"
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </>
          )}

          {activeTab === 1 && (
            <>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Add Admin User
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Grant admin privileges to users
                </Typography>
                <form onSubmit={handleAddAdminUser}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      type="email"
                      required
                      size="small"
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<AdminPanelSettingsIcon />}
                      disabled={loading}
                    >
                      Add Admin
                    </Button>
                  </Box>
                </form>
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Admin Users ({adminUsers.length})
                </Typography>
                <List>
                  {adminUsers.map((user) => (
                    <ListItem key={user.email} divider>
                      <ListItemText
                        primary={user.email}
                        secondary={`Added: ${formatDate(user.createdAt)}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRemoveAdminUser(user.email)}
                          disabled={loading || user.email === currentUser?.email}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                  {adminUsers.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No admin users"
                        secondary="Users added here will have full admin access"
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </>
          )}

          {activeTab === 2 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Family Sharing ({sharedUsers.length}/5)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Share your subscription access with family members
              </Typography>
              <form onSubmit={handleShareAccess}>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Family Member Email"
                    value={newFamilyEmail}
                    onChange={(e) => setNewFamilyEmail(e.target.value)}
                    type="email"
                    required
                    size="small"
                  />
                  <Tooltip title={sharedUsers.length >= 5 ? "Maximum limit reached" : "Share access"}>
                    <span>
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<ShareIcon />}
                        disabled={sharedUsers.length >= 5 || loading}
                      >
                        Share
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </form>

              <List>
                {sharedUsers.map((user) => (
                  <ListItem key={user.email} divider>
                    <ListItemText
                      primary={user.email}
                      secondary={`Shared: ${formatDate(user.createdAt)}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleRemoveSharedAccess(user.email)}
                        disabled={loading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {sharedUsers.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No family members"
                      secondary="Share your subscription with up to 5 family members"
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          )}
        </>
      )}

      {!adminView && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Family Sharing ({sharedUsers.length}/5)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share your subscription access with family members
          </Typography>
          <form onSubmit={handleShareAccess}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Family Member Email"
                value={newFamilyEmail}
                onChange={(e) => setNewFamilyEmail(e.target.value)}
                type="email"
                required
                size="small"
              />
              <Tooltip title={sharedUsers.length >= 5 ? "Maximum limit reached" : "Share access"}>
                <span>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<ShareIcon />}
                    disabled={sharedUsers.length >= 5 || loading}
                  >
                    Share
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </form>

          <List>
            {sharedUsers.map((user) => (
              <ListItem key={user.email} divider>
                <ListItemText
                  primary={user.email}
                  secondary={`Shared: ${formatDate(user.createdAt)}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleRemoveSharedAccess(user.email)}
                    disabled={loading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {sharedUsers.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No family members"
                  secondary="Share your subscription with up to 5 family members"
                />
              </ListItem>
            )}
          </List>
        </Paper>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};
