import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { auth } from './config/firebase.js';
import { isAdmin } from './services/firestore.js';
import { logger } from './utils/logger.js';

// Import route handlers
import chatRouter from './routes/chat.js';
import studentsRouter from './routes/students.js';
import collegesRouter from './routes/colleges.js';
import studentDataRouter from './routes/student-data.js';
import adminRouter from './routes/admin.js';
import tasksRouter from './routes/tasks.js';
import calendarRouter from './routes/calendar.js';
import pinResearchRouter from './routes/pin-research.js';
import plansRouter from './routes/plans.js';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: [
    'https://collegebot-dev-52f43.web.app',
    'https://collegebot-dev-52f43.firebaseapp.com',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['x-api-key'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200,
  preflightContinue: false
};

// Apply CORS before any other middleware
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
app.use(cors(corsOptions));

// Rate limiting configuration
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each user to 50 requests per windowMs
  keyGenerator: (req) => req.user?.uid || req.ip, // Rate limit by user ID if authenticated, otherwise by IP
  message: {
    error: 'Too many requests from this user, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const analysisRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 analysis requests per hour
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    error: 'Too many analysis requests from this user, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Set up body parsing with increased limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));
app.use(morgan('dev'));

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
  logger.debug('Authentication middleware called', {
    url: req.originalUrl,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn('Authentication failed: No authorization header', { url: req.originalUrl });
      res.status(401).json({ error: 'No authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    logger.debug('Token found, attempting to verify');
    const decodedToken = await auth.verifyIdToken(token);
    
    // Add user to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      isAdmin: decodedToken.admin || false
    };
    
    logger.info('Authentication successful', { 
      email: decodedToken.email,
      uid: decodedToken.uid,
      url: req.originalUrl
    });
    next();
  } catch (error) {
    logger.error('Authentication error', { 
      error: error instanceof Error ? error.message : String(error),
      url: req.originalUrl
    });
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
};

// Admin middleware
const adminMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      logger.warn('Admin middleware: User not authenticated', { url: req.originalUrl });
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userIsAdmin = await isAdmin(req.user.email);
    if (!userIsAdmin) {
      logger.warn('Admin middleware: User not authorized', { 
        email: req.user.email,
        url: req.originalUrl
      });
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: req.originalUrl
    });
    res.status(500).json({ error: 'Server error' });
    return;
  }
};

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Protected routes with rate limiting
app.use('/api/chat/message', authMiddleware, chatRateLimit, chatRouter);
app.use('/api/chat/analyze', authMiddleware, analysisRateLimit, chatRouter);
app.use('/api/chat/process-all', authMiddleware, analysisRateLimit, chatRouter);
app.use('/api/chat', authMiddleware, chatRouter); // Other chat routes without rate limiting
app.use('/api/students', authMiddleware, studentsRouter);
app.use('/api/colleges', authMiddleware, collegesRouter);
app.use('/api/student-data', authMiddleware, studentDataRouter);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/calendar', authMiddleware, calendarRouter);
app.use('/api/pin-research', authMiddleware, pinResearchRouter);
app.use('/api/plans', authMiddleware, plansRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  logger.info('Server started', { 
    port,
    environment: process.env.NODE_ENV || 'development'
  });
});
