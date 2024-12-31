import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Box,
  Drawer,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CollegeSearch } from './components/CollegeSearch';
import { College, SearchResult } from './types/college';

const App: React.FC = () => {
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);

  const handleSearch = async (query: string): Promise<SearchResult> => {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search failed:', response.status, errorText);
        throw new Error(`Search failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Search results:', data);
      return data;
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof Error) {
        throw new Error(`Search failed: ${error.message}`);
      }
      throw new Error('Search failed: Unknown error');
    }
  };

  const handleSelectCollege = (college: College) => {
    setSelectedCollege(college);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div">
            CollegeBot
          </Typography>
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Find Your Perfect College Match
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" paragraph>
            Use our AI-powered search to discover colleges that match your interests and goals.
          </Typography>
          <CollegeSearch onSearch={handleSearch} onSelectCollege={handleSelectCollege} />
        </Paper>
      </Container>

      <Drawer
        anchor="right"
        open={!!selectedCollege}
        onClose={() => setSelectedCollege(null)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '100%',
            maxWidth: 600,
            p: 3,
          },
        }}
      >
        {selectedCollege && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h5">{selectedCollege.name}</Typography>
              <IconButton onClick={() => setSelectedCollege(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
            {selectedCollege.sections?.admissions && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Admissions
                </Typography>
                <Typography>{selectedCollege.sections.admissions}</Typography>
              </Box>
            )}
            {selectedCollege.sections?.expenses && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Expenses
                </Typography>
                <Typography>{selectedCollege.sections.expenses}</Typography>
              </Box>
            )}
            {selectedCollege.sections?.financialAid && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Financial Aid
                </Typography>
                <Typography>{selectedCollege.sections.financialAid}</Typography>
              </Box>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default App;
