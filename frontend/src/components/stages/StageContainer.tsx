import React from 'react';
import { Box, styled } from '@mui/material';

export const StageContainer = styled(Box)(({ theme }) => ({
  flex: 1,                    // fills ALL left‑over width
  display: 'flex',
  flexDirection: 'column',
  width: '100%',              // relative, not absolute
  maxWidth: '100%',           // prevent overflow
  minWidth: 0,                // lets flexbox shrink instead of overflow
  height: '100%',             // explicit height for Google Maps
  minHeight: '100vh',         // minimum height to ensure proper rendering
  padding: theme.spacing(3),
  overflow: 'hidden',
  background: theme.palette.background.paper,
  // Force all child elements to respect container width
  '& > *': {
    maxWidth: '100%',
    minWidth: 0,
  },
  // Ensure nested flex containers behave properly
  '& .MuiBox-root': {
    maxWidth: '100%',
    minWidth: 0,
  }
}));

/*export const StageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  maxWidth: 'none !important', // Force override any constraints
  minWidth: 0,
  flex: '1 1 auto',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3), // Add padding here instead of App.tsx
  // Force full width with CSS
  '&': {
    width: '100% !important',
    maxWidth: 'none !important',
    flex: '1 1 auto !important'
  },
  '& > *': {
    minHeight: 0,
  }
}));*/

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
