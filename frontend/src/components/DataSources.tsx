import React from 'react';
import {
  Box,
  Paper,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { WordCloud } from './WordCloud';
import { College, WordCloudWord } from '../types/college';

interface DataSourcesProps {
  colleges: College[];
  onToggleDataSource: (collegeName: string, enabled: boolean) => void;
}

export const DataSources: React.FC<DataSourcesProps> = ({
  colleges,
  onToggleDataSource,
}) => {
  const wordCloudData: WordCloudWord[] = colleges.map((college) => ({
    text: college.name,
    value: 40,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography variant="h6" gutterBottom>
        Colleges Under Consideration ({colleges.length})
      </Typography>
      
      {colleges.length > 0 ? (
        <>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              height: 400, 
              backgroundColor: 'grey.50',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <WordCloud 
              words={wordCloudData}
              width={700}
              height={350}
            />
          </Paper>

          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Data Sources to Include in AI Analysis
            </Typography>
            <FormGroup>
              {colleges.map((college) => (
                <FormControlLabel
                  key={college.name}
                  control={
                    <Checkbox
                      defaultChecked
                      onChange={(e) => onToggleDataSource(college.name, e.target.checked)}
                    />
                  }
                  label={college.name}
                />
              ))}
            </FormGroup>
          </Paper>
        </>
      ) : (
        <Typography color="text.secondary">
          Search for colleges to add them to your consideration list.
        </Typography>
      )}
    </Box>
  );
};
