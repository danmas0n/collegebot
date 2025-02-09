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
  Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc,
  where,
  serverTimestamp,
  FieldValue,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../../config/firebase';

interface WhitelistedUser {
  email: string;
  createdAt: Timestamp | FieldValue | null;
  createdBy?: string;
  userId?: string;
  parentUserId?: string;
}

interface WhitelistManagerProps {
  adminView: boolean;
}

export const WhitelistManager = ({ adminView }: WhitelistManagerProps) => {
  const { isAdmin, currentUser } = useAuth();
  const [users, setUsers] = useState<WhitelistedUser[]>([]);
  const [sharedUsers, setSharedUsers] = useState<WhitelistedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch whitelisted users (admin view)
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'whitelisted_users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const whitelistedUsers: WhitelistedUser[] = [];
      snapshot.forEach((doc) => {
        whitelistedUsers.push({
          email: doc.id,
          ...doc.data()
        } as WhitelistedUser);
      });
      setUsers(whitelistedUsers.sort((a, b) => a.email.localeCompare(b.email)));
    }, (error) => {
      console.error('Error fetching whitelist:', error);
      setError('Failed to load whitelisted users');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Fetch shared users (regular user view)
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'whitelisted_users'), 
      where('parentUserId', '==', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shared: WhitelistedUser[] = [];
      snapshot.forEach((doc) => {
        shared.push({
          email: doc.id,
          ...doc.data()
        } as WhitelistedUser);
      });
      setSharedUsers(shared.sort((a, b) => a.email.localeCompare(b.email)));
    }, (error) => {
      console.error('Error fetching shared users:', error);
      setError('Failed to load shared users');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !isAdmin || !currentUser) return;

    try {
      const email = newEmail.trim().toLowerCase();
      
      // Generate a userId from the email (they'll get this UID when they sign up)
      const userId = email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      // Add to whitelist with userId
      await setDoc(doc(db, 'whitelisted_users', email), {
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
        userId
      });
      
      setNewEmail('');
      setSuccess(`Added ${email} to whitelist`);
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user to whitelist');
    }
  };

  const handleShareAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !currentUser) return;

    try {
      // Check if already at limit
      if (sharedUsers.length >= 5) {
        setError('Maximum number of shared users (5) reached');
        return;
      }

      const email = newEmail.trim().toLowerCase();
      
      // Check if user is trying to share with themselves
      if (email === currentUser.email) {
        setError('You cannot share access with yourself');
        return;
      }

      // Check if user is already shared with
      if (sharedUsers.some(user => user.email === email)) {
        setError('You have already shared access with this user');
        return;
      }
      
      // Generate a userId from the email (they'll get this UID when they sign up)
      const userId = email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      // Check if user is already whitelisted by someone else
      const whitelistDoc = await getDoc(doc(db, 'whitelisted_users', email));
      if (whitelistDoc.exists() && whitelistDoc.data().parentUserId && whitelistDoc.data().parentUserId !== currentUser.uid) {
        setError('This user already has shared access from another user');
        return;
      }
      
      // Add to whitelist with userId and parentUserId
      await setDoc(doc(db, 'whitelisted_users', email), {
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
        userId,
        parentUserId: currentUser.uid
      });
      
      setNewEmail('');
      setSuccess(`Shared access with ${email}`);
    } catch (err) {
      console.error('Error sharing access:', err);
      setError('Failed to share access');
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (!isAdmin) return;

    try {
      await deleteDoc(doc(db, 'whitelisted_users', email));
      setSuccess(`Removed ${email} from whitelist`);
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Failed to remove user from whitelist');
    }
  };

  const handleRemoveSharedAccess = async (email: string) => {
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, 'whitelisted_users', email));
      setSuccess(`Removed shared access for ${email}`);
    } catch (err) {
      console.error('Error removing shared access:', err);
      setError('Failed to remove shared access');
    }
  };

  const formatDate = (timestamp: Timestamp | FieldValue | null) => {
    if (!timestamp || !(timestamp instanceof Timestamp)) {
      return 'Date not available';
    }
    return timestamp.toDate().toLocaleDateString();
  };

  if (!currentUser) {
    return (
      <Alert severity="error">
        You must be logged in to access this page.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      {adminView && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Add User to Whitelist (Admin)
            </Typography>
            <form onSubmit={handleAddUser}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  required
                  size="small"
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddIcon />}
                >
                  Add
                </Button>
              </Box>
            </form>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Whitelisted Users ({users.length})
            </Typography>
            <List>
              {users.map((user) => (
                <ListItem key={user.email} divider>
                  <ListItemText
                    primary={user.email}
                    secondary={
                      <>
                        Added: {formatDate(user.createdAt)}
                        {user.parentUserId && ' (Shared Access)'}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleRemoveUser(user.email)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {adminView ? "Share Access" : "Family Sharing"} ({sharedUsers.length}/5)
        </Typography>
        <form onSubmit={handleShareAccess}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              label="Email Address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
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
                  disabled={sharedUsers.length >= 5}
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
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

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
