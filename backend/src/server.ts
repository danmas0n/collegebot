import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { config } from 'dotenv';
import { auth } from './config/firebase.js';
import { isAdmin } from './services/firestore.js';

// Import route handlers
import chatRouter from './routes/chat.js';
import studentsRouter from './routes/students.js';
import collegesRouter from './routes/colleges.js';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  exposedHeaders: ['x-api-key'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));
app.use(bodyParser.json());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));

// Add type declaration for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any; // Replace 'any' with a more specific type if available
    }
  }
}

// Authentication middleware
const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Authentication middleware called');
  console.log('URL:', req.originalUrl);
  console.log('Headers:', req.headers);
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header');
      res.status(401).json({ error: 'No authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    console.log('Token found, attempting to verify');
    const decodedToken = await auth.verifyIdToken(token);
    
    // Add user to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      isAdmin: decodedToken.admin || false
    };
    
    console.log('Authentication successful for user:', decodedToken.email);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
};

// Admin middleware
const adminMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      console.log('Not authenticated');
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!req.user.isAdmin) {
      console.log('Not authorized');
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    next();
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
    return;
  }
};

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Protected routes
app.use('/api/chat/claude', authMiddleware, chatRouter);
app.use('/api/students', authMiddleware, studentsRouter);
app.use('/api/colleges', authMiddleware, collegesRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
