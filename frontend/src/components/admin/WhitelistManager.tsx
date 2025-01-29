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
  Snackbar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  FieldValue,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';

interface WhitelistedUser {
  email: string;
  createdAt: Timestamp | FieldValue | null;
}

export const WhitelistManager = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<WhitelistedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'whitelisted_users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const whitelistedUsers: WhitelistedUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        whitelistedUsers.push({
          email: doc.id,
          createdAt: data.createdAt
        });
      });
      setUsers(whitelistedUsers.sort((a, b) => a.email.localeCompare(b.email)));
    }, (error) => {
      console.error('Error fetching whitelist:', error);
      setError('Failed to load whitelisted users');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !isAdmin) return;

    try {
      const email = newEmail.trim().toLowerCase();
      await setDoc(doc(db, 'whitelisted_users', email), {
        email,
        createdAt: serverTimestamp()
      });
      setNewEmail('');
      setSuccess(`Added ${email} to whitelist`);
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user to whitelist');
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

  const formatDate = (timestamp: Timestamp | FieldValue | null) => {
    if (!timestamp || !(timestamp instanceof Timestamp)) {
      return 'Date not available';
    }
    return timestamp.toDate().toLocaleDateString();
  };

  if (!isAdmin) {
    return (
      <Alert severity="error">
        You do not have permission to access this page.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add User to Whitelist
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

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Whitelisted Users ({users.length})
        </Typography>
        <List>
          {users.map((user) => (
            <ListItem key={user.email} divider>
              <ListItemText
                primary={user.email}
                secondary={`Added: ${formatDate(user.createdAt)}`}
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