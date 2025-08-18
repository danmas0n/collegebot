import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Block as SuspendIcon,
  CheckCircle as RestoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface SubscriptionUser {
  id: string;
  email: string;
  subscriptionStatus: string;
  isMainAccount: boolean;
  familyMemberEmails?: string[];
  accessSuspended?: boolean;
  createdAt?: any;
  stripeCustomerId?: string;
  subscriptionId?: string;
  trialDaysRemaining?: number;
}

interface SubscriptionDetails {
  hasAccess: boolean;
  accessType: string;
  subscriptionStatus?: string;
  trialDaysRemaining?: number;
  isMainAccount?: boolean;
  familyMemberCount?: number;
  userData?: any;
  email: string;
}

export const SubscriptionUserManager: React.FC = () => {
  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<SubscriptionUser | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [userDetails, setUserDetails] = useState<SubscriptionDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/subscription-users', {
        headers: {
          'Authorization': `Bearer ${await (await import('../../utils/auth')).getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription users');
      }

      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (email: string) => {
    try {
      const response = await fetch(`/api/admin/subscription-users/${encodeURIComponent(email)}/details`, {
        headers: {
          'Authorization': `Bearer ${await (await import('../../utils/auth')).getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      setUserDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
    }
  };

  const handleViewDetails = async (user: SubscriptionUser) => {
    setSelectedUser(user);
    setDetailsDialog(true);
    await fetchUserDetails(user.email);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/subscription-users/${encodeURIComponent(selectedUser.email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await (await import('../../utils/auth')).getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      await fetchUsers();
      setDeleteDialog(false);
      setSelectedUser(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendUser = async (user: SubscriptionUser) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/subscription-users/${encodeURIComponent(user.email)}/suspend`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await (await import('../../utils/auth')).getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to suspend user');
      }

      await fetchUsers();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async (user: SubscriptionUser) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/subscription-users/${encodeURIComponent(user.email)}/restore`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await (await import('../../utils/auth')).getIdToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to restore user');
      }

      await fetchUsers();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore user');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string, suspended?: boolean) => {
    if (suspended) return 'error';
    switch (status) {
      case 'trialing': return 'info';
      case 'active': return 'success';
      case 'past_due': return 'warning';
      case 'canceled': return 'error';
      case 'unpaid': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string, suspended?: boolean, trialDays?: number) => {
    if (suspended) return 'Suspended';
    if (status === 'trialing' && trialDays !== undefined) {
      return `Trial (${trialDays} days left)`;
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Subscription Users
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchUsers}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Account Type</TableCell>
              <TableCell>Family Members</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(user.subscriptionStatus, user.accessSuspended, user.trialDaysRemaining)}
                    color={getStatusColor(user.subscriptionStatus, user.accessSuspended)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.isMainAccount ? 'Main Account' : 'Family Member'}
                </TableCell>
                <TableCell>
                  {user.familyMemberEmails?.length || 0}
                </TableCell>
                <TableCell>
                  {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(user)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {user.accessSuspended ? (
                      <Tooltip title="Restore Access">
                        <IconButton
                          size="small"
                          onClick={() => handleRestoreUser(user)}
                          disabled={actionLoading}
                        >
                          <RestoreIcon />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Suspend Access">
                        <IconButton
                          size="small"
                          onClick={() => handleSuspendUser(user)}
                          disabled={actionLoading}
                        >
                          <SuspendIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Delete User">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialog(true);
                        }}
                        disabled={actionLoading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {users.length === 0 && !loading && (
        <Box textAlign="center" py={4}>
          <Typography variant="body1" color="text.secondary">
            No subscription users found.
          </Typography>
        </Box>
      )}

      {/* User Details Dialog */}
      <Dialog
        open={detailsDialog}
        onClose={() => {
          setDetailsDialog(false);
          setUserDetails(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          User Details: {selectedUser?.email}
        </DialogTitle>
        <DialogContent>
          {userDetails ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Subscription Info
                    </Typography>
                    <Typography variant="body2">
                      <strong>Status:</strong> {userDetails.subscriptionStatus}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Access Type:</strong> {userDetails.accessType}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Has Access:</strong> {userDetails.hasAccess ? 'Yes' : 'No'}
                    </Typography>
                    {userDetails.trialDaysRemaining !== undefined && (
                      <Typography variant="body2">
                        <strong>Trial Days Remaining:</strong> {userDetails.trialDaysRemaining}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Main Account:</strong> {userDetails.isMainAccount ? 'Yes' : 'No'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Family Members:</strong> {userDetails.familyMemberCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              {userDetails.userData && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Account Details
                      </Typography>
                      <Typography variant="body2">
                        <strong>Stripe Customer ID:</strong> {userDetails.userData.stripeCustomerId || 'N/A'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Subscription ID:</strong> {userDetails.userData.subscriptionId || 'N/A'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Created:</strong> {userDetails.userData.createdAt ? 
                          new Date(userDetails.userData.createdAt.seconds * 1000).toLocaleString() : 'N/A'}
                      </Typography>
                      {userDetails.userData.accessSuspended && (
                        <>
                          <Typography variant="body2">
                            <strong>Suspended:</strong> {userDetails.userData.suspendedAt ? 
                              new Date(userDetails.userData.suspendedAt.seconds * 1000).toLocaleString() : 'Yes'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Suspended By:</strong> {userDetails.userData.suspendedBy || 'N/A'}
                          </Typography>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          ) : (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsDialog(false);
            setUserDetails(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{selectedUser?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will:
          </Typography>
          <ul>
            <li>Cancel their Stripe subscription</li>
            <li>Remove them from Firestore</li>
            <li>Reset family members to allow their own trials</li>
          </ul>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubscriptionUserManager;
