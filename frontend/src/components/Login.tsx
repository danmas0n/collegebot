import { Button, Typography, Box, Alert, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import GoogleIcon from '@mui/icons-material/Google';
import LogoutIcon from '@mui/icons-material/Logout';
import { trackUserLogin, trackUserLogout } from '../utils/analytics';

export const Login = () => {
  const { currentUser, isWhitelisted, isAdmin, signInWithGoogle, logout } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      trackUserLogin(currentUser?.uid);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleLogout = async () => {
    try {
      trackUserLogout(currentUser?.uid);
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (currentUser && !isWhitelisted) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your account ({currentUser.email}) is not whitelisted.
          Please contact the administrator for access.
        </Alert>
        <Button 
          variant="outlined" 
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
          color="inherit"
        >
          Sign Out
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {currentUser ? (
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" color="inherit">
            {currentUser.email}
            {isAdmin && ' (Admin)'}
          </Typography>
          <Button 
            variant="outlined" 
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            color="inherit"
            size="small"
          >
            Sign Out
          </Button>
        </Stack>
      ) : (
        <Button
          variant="outlined"
          onClick={handleLogin}
          startIcon={<GoogleIcon />}
          color="inherit"
          size="small"
        >
          Sign in with Google
        </Button>
      )}
    </Box>
  );
};
