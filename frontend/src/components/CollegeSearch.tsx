import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material';
import { College, SearchResult } from '../types/college';

interface CollegeSearchProps {
  onSearch: (query: string) => Promise<SearchResult>;
  onSelectCollege: (college: College) => void;
}

export const CollegeSearch: React.FC<CollegeSearchProps> = ({
  onSearch,
  onSelectCollege,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<College[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log('Searching for:', query);
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onSearch(query);
      setResults(result.results);
    } catch (err) {
      setError('Error searching for colleges. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <form onSubmit={handleSearch}>
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            label="Search for colleges"
            variant="outlined"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !query.trim()}
            fullWidth
            sx={{ height: 56 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Search'
            )}
          </Button>
        </Box>
      </form>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={2}>
        {results.length === 0 && !loading && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">
              No results found. Try a different search term.
            </Typography>
          </Grid>
        )}
        {results.map((college, index) => (
          <Grid item xs={12} key={index}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {college.name}
                  {college.sections && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.7rem',
                      }}
                    >
                      CDS
                    </Typography>
                  )}
                </Typography>
                {college.description && (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {college.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    onClick={() => onSelectCollege(college)}
                    variant="contained"
                  >
                    View Details
                  </Button>
                  {college.url && (
                    <Button
                      size="small"
                      href={college.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit Website
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
