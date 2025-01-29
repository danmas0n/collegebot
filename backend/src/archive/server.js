import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';

// Import route handlers
import chatRoutes from './routes/chat.js';
import studentRoutes from './routes/students.js';
import collegeRoutes from './routes/colleges.js';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  exposedHeaders: ['x-api-key'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));

// Mount routes
app.use('/api/chat/claude', chatRoutes);
app.use('/api/mcp/student-data', studentRoutes);
app.use('/api/students', studentRoutes); // Keep this for backward compatibility
app.use('/api/colleges', collegeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
