import winston from 'winston';
import path from 'path';
import { LoggingWinston } from '@google-cloud/logging-winston';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize Cloud Logging transport
const cloudLogging = new LoggingWinston({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'collegebot-dev-52f43',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  logName: 'collegebot-logs'
});

// Define transports based on environment
const transports = [];

// Always add console transport for development visibility
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
);

// Add file transports in development (default when NODE_ENV not set)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'claude.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          return `[${timestamp}] ${level}: ${message} ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''}`;
        })
      )
    })
  );
}

// Add Cloud Logging in production
if (process.env.NODE_ENV === 'production') {
  transports.push(cloudLogging);
}

// Configure the Winston logger with environment-specific transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'collegebot',
    environment: process.env.NODE_ENV || 'development'
  },
  transports
});

// Create a child logger specifically for Claude
const claudeLogger = logger.child({ service: 'claude' });

export { logger, claudeLogger };
