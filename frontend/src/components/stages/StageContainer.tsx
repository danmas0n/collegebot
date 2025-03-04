import React from 'react';
import { Box, Paper, styled } from '@mui/material';

export const StageContainer = styled(Paper)(({ theme }) => ({
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  height: 'calc(100vh - 180px)', // Account for AppBar, WizardStepper, and padding
  overflow: 'hidden',
  padding: theme.spacing(3),
  '& > *': {
    minHeight: 0, // Allow children to scroll
  }
}));

export const StageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const StageContent = styled(Box)({
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

export const StageFooter = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  paddingTop: theme.spacing(2),
}));
