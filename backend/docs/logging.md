# Logging Configuration

The application uses a hybrid logging approach that combines local development visibility with production-grade logging.

## Development Environment

In development mode (`NODE_ENV=development`), logs are:
1. Written to console with colorization for immediate visibility
2. Saved to local files in the `logs/` directory:
   - `combined.log`: All logs (info and above)
   - `error.log`: Error logs only
   - `claude.log`: Claude-specific logs

## Production Environment

In production (`NODE_ENV=production`), logs are:
1. Written to console for container/service logs
2. Sent to Google Cloud Logging for centralized logging

## Environment Variables

```bash
# Required for Cloud Logging
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Optional
NODE_ENV=development|production  # defaults to development
LOG_LEVEL=debug|info|warn|error # defaults to info
```

## Usage

```javascript
import { logger, claudeLogger } from '../utils/logger';

// Basic logging
logger.info('Simple message');

// With metadata
logger.info('Message with context', { 
  userId: '123',
  action: 'login' 
});

// Error logging
try {
  // ... some code
} catch (error) {
  logger.error('Operation failed', { 
    error: error.message,
    stack: error.stack
  });
}

// Claude-specific logging
claudeLogger.info('Claude message', {
  messageId: '456',
  type: 'user_input'
});
```

## Viewing Logs

### Local Development
- Check console output
- View log files in `backend/logs/` directory

### Production
- Use Google Cloud Console to view logs
- Stream logs using gcloud CLI:
  ```bash
  gcloud logging tail "resource.type=cloud_run_revision"
  ```

## Migration Strategy

The codebase currently uses a mix of console.log and Winston logger. The plan is to:
1. Keep existing console.logs for development visibility
2. Add Cloud Logging for production monitoring
3. Gradually migrate console.logs to Winston as code is touched

When modifying files, prefer using the Winston logger for new code and consider migrating existing console.logs in the file you're working on.
