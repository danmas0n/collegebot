import React from 'react';
import { Box, Paper, styled } from '@mui/material';

export const StageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  maxWidth: 'none !important', // Force override any constraints
  minWidth: 0,
  flex: '1 1 auto',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  // Force full width with CSS
  '&': {
    width: '100% !important',
    maxWidth: 'none !important',
    flex: '1 1 auto !important'
  },
  '& > *': {
    minHeight: 0,
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
