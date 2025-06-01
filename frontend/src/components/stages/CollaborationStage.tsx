import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  Divider,
  Tooltip,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Share as ShareIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Person as PersonIcon,
  AdminPanelSettings as OwnerIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { StageContainer } from './StageContainer';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

interface SharedUser {
  email: string;
  createdAt: any;
  createdBy?: string;
  userId?: string;
  parentUserId?: string;
}

export const CollaborationStage: React.FC = () => {
  const { currentUser } = useAuth();
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCounselorModal, setShowCounselorModal] = useState(false);

  // Get the current app URL for sharing
  const appUrl = window.location.origin;

  // Fetch shared users
  useEffect(() => {
    const fetchSharedUsers = async () => {
      try {
        const response = await api.get('/api/admin/shared-users');
        if (response.ok) {
          const users = await response.json();
          setSharedUsers(users);
        }
      } catch (err) {
        console.error('Error fetching shared users:', err);
      }
    };

    if (currentUser) {
      fetchSharedUsers();
    }
  }, [currentUser]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Check if already at limit
      if (sharedUsers.length >= 5) {
        setError('Maximum number of family members (5) reached');
        setLoading(false);
        return;
      }

      const email = newEmail.trim().toLowerCase();
      
      // Check if user is trying to share with themselves
      if (email === currentUser?.email) {
        setError('You cannot invite yourself');
        setLoading(false);
        return;
      }

      // Check if user is already invited
      if (sharedUsers.some(user => user.email === email)) {
        setError('This person is already part of your family group');
        setLoading(false);
        return;
      }
      
      // Generate a userId from the email
      const userId = email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const response = await api.post('/api/admin/share', {
        email,
        userId
      });

      if (response.ok) {
        setSuccess(`Invited ${email} to your family group`);
        setNewEmail('');
        
        // Refresh the list
        const updatedResponse = await api.get('/api/admin/shared-users');
        if (updatedResponse.ok) {
          const users = await updatedResponse.json();
          setSharedUsers(users);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Error inviting user:', err);
      setError('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    try {
      const response = await api.delete(`/api/admin/share/${encodeURIComponent(email)}`);
      
      if (response.ok) {
        setSuccess(`Removed ${email} from family group`);
        
        // Refresh the list
        const updatedResponse = await api.get('/api/admin/shared-users');
        if (updatedResponse.ok) {
          const users = await updatedResponse.json();
          setSharedUsers(users);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove user');
      }
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Failed to remove user');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setSuccess('App link copied to clipboard!');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Date not available';
    
    try {
      // Handle Firestore timestamp
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
      }
      // Handle regular date string
      return new Date(timestamp).toLocaleDateString();
    } catch (e) {
      return 'Date not available';
    }
  };

  return (
    <StageContainer data-testid="collaboration-stage">
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Collaborate with Family & Counselors
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Invite family members and college counselors to collaborate on the college planning process
          </Typography>
        </Box>
        {/* Current Family Group */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            Your Family Group ({sharedUsers.length + 1}/6)
          </Typography>
          
          <List>
            {/* Current user (owner) */}
            <ListItem divider>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {currentUser?.email}
                    <Chip 
                      label="Owner" 
                      size="small" 
                      color="primary" 
                      icon={<OwnerIcon />}
                    />
                  </Box>
                }
                secondary="You are the owner of this family group"
              />
            </ListItem>

            {/* Invited users */}
            {sharedUsers.map((user) => (
              <ListItem key={user.email} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {user.email}
                      <Chip 
                        label="Invited" 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={`Invited: ${formatDate(user.createdAt)}`}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Remove from family group">
                    <IconButton
                      edge="end"
                      aria-label="remove"
                      onClick={() => handleRemoveUser(user.email)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Invite New Member */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShareIcon />
            Invite Family Member or Counselor
          </Typography>
          
          <form onSubmit={handleInviteUser}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                required
                size="small"
                placeholder="Enter their email address"
                disabled={loading || sharedUsers.length >= 5}
              />
              <Tooltip title={sharedUsers.length >= 5 ? "Maximum limit reached" : "Send invitation"}>
                <span>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<ShareIcon />}
                    disabled={loading || sharedUsers.length >= 5}
                  >
                    {loading ? 'Inviting...' : 'Invite'}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </form>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>How it works:</strong> Enter their email address and they'll be able to sign in with Google 
              using that email to access your student's college planning data.
            </Typography>
          </Alert>
        </Paper>

        {/* Share App Link */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CopyIcon />
            Share App Link
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send this link to invited family members and counselors:
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            p: 2, 
            bgcolor: 'grey.100', 
            borderRadius: 1,
            mb: 2
          }}>
            <Link 
              href={appUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              sx={{ flex: 1, wordBreak: 'break-all' }}
            >
              {appUrl}
            </Link>
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={handleCopyLink}
              size="small"
            >
              Copy
            </Button>
          </Box>

          <Alert severity="success">
            <Typography variant="body2">
              <strong>Simple sharing:</strong> Just send them the link above! They can sign in with Google 
              using the email address you invited, and they'll automatically have access to collaborate.
            </Typography>
          </Alert>
        </Paper>

        {/* Find College Counselor */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon />
            Professional Support
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Need expert guidance? Connect with a qualified college counselor to help navigate the admissions process.
          </Typography>
          
          <Button
            variant="contained"
            color="secondary"
            startIcon={<SearchIcon />}
            onClick={() => setShowCounselorModal(true)}
            sx={{ mb: 2 }}
          >
            Find a College Counselor
          </Button>
          
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Coming soon:</strong> We're building a network of verified college counselors 
              to help families navigate the college admissions process with expert guidance.
            </Typography>
          </Alert>
        </Paper>

        {/* Error/Success Messages */}
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

        {/* Coming Soon Modal */}
        <Dialog
          open={showCounselorModal}
          onClose={() => setShowCounselorModal(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ textAlign: 'center' }}>
            <SearchIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
            <Typography variant="h5" component="div">
              Find a College Counselor
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', color: 'primary.main' }}>
              Coming Soon!
            </Typography>
            <Typography variant="body1" paragraph sx={{ textAlign: 'center' }}>
              We're building a comprehensive network of verified college counselors to help families 
              navigate the college admissions process with expert guidance.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              This feature will include:
            </Typography>
            <Box component="ul" sx={{ mt: 2, pl: 3 }}>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Verified college counselor profiles
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Specialization matching (public vs private, specific regions, etc.)
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Direct messaging and scheduling
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Integrated collaboration on your student's college plan
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
            <Button
              onClick={() => setShowCounselorModal(false)}
              variant="contained"
              color="primary"
            >
              Got it!
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </StageContainer>
  );
};
