# CollegeBot

A web application that helps students find and evaluate colleges that match their preferences and requirements.

## Project Structure

```
collegebot/
├── backend/         # Express.js backend
├── frontend/        # React frontend
├── mcp/            # Model Context Protocol services
├── firestore.rules  # Firestore security rules
└── firebase.json    # Firebase configuration
```

## Cloud Architecture

CollegeBot is built on Google Cloud Platform (GCP) and Firebase, leveraging several cloud services for scalability and reliability:

### Infrastructure Overview

- **Frontend**: Hosted on Firebase Hosting
  - Static assets served through Firebase's global CDN
  - Automatic SSL certificate management
  - Custom domain support
  - URL: https://collegebot-dev-52f43.web.app

- **Backend**: Deployed on Cloud Run
  - Containerized Node.js service
  - Automatic scaling based on demand
  - Pay-per-use pricing model
  - URL: https://backend-859016258149.us-central1.run.app

- **Database**: Firebase Firestore
  - NoSQL document database
  - Real-time updates
  - Automatic scaling
  - Strong security rules

- **Authentication**: Firebase Authentication
  - Google Sign-In integration
  - JWT token management
  - Role-based access control

### Deployment Flow

1. **Frontend Deployment**:
   - Build process: TypeScript compilation + Vite bundling
   - Assets deployed to Firebase Hosting CDN
   - Automatic versioning and rollback support

2. **Backend Deployment**:
   - Docker container built for linux/amd64
   - Image pushed to Google Container Registry
   - Deployed to Cloud Run with automatic scaling
   - Environment variables managed through Cloud Run

3. **Database Updates**:
   - Firestore security rules deployed via Firebase CLI
   - Indexes automatically updated
   - Backup and restore available through GCP Console

### Monitoring and Maintenance

- **Cloud Run Dashboard**: Monitor backend performance and scaling
- **Firebase Console**: Track hosting performance and authentication
- **Firestore Console**: Monitor database usage and performance
- **Cloud Logging**: Centralized logs for all services
  - Production logs available in Google Cloud Console
  - Local development logs in `backend/logs/`
  - Structured logging with Winston
  - See `backend/docs/logging.md` for details

### Viewing Application Logs

#### Local Development
1. Console Output:
   - Backend logs appear in your terminal
   - Frontend logs in browser dev tools
   - Colorized for better readability

2. Log Files (in `backend/logs/`):
   ```bash
   # View all logs
   tail -f backend/logs/combined.log
   
   # View error logs only
   tail -f backend/logs/error.log
   
   # View Claude-specific logs
   tail -f backend/logs/claude.log
   ```

#### Production
1. Google Cloud Console:
   - Go to Cloud Logging > Logs Explorer
   - Filter: `resource.type="cloud_run_revision"`
   - View structured logs with metadata

2. Command Line:
   ```bash
   # Stream all logs
   gcloud logging tail "resource.type=cloud_run_revision"
   
   # Filter for specific severity
   gcloud logging tail "resource.type=cloud_run_revision AND severity>=ERROR"
   
   # Filter for specific service
   gcloud logging tail "resource.type=cloud_run_revision AND jsonPayload.service=claude"
   ```

## Quick Start Guide

### Local Development

1. Start the Firebase emulators:
   ```bash
   firebase emulators:start
   ```

2. Start the backend:
   ```bash
   cd backend
   npm install  # Only needed first time or when dependencies change
   npm run dev
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm install  # Only needed first time or when dependencies change
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Firebase Emulator UI: http://localhost:4000

### Deploying to Production

1. Deploy the backend to Cloud Run:
   ```bash
   # From project root
   docker build --platform linux/amd64 -t gcr.io/collegebot-dev/backend -f backend/Dockerfile .
   docker push gcr.io/collegebot-dev/backend
   gcloud run deploy backend --image gcr.io/collegebot-dev/backend --platform managed --region us-central1 --project collegebot-dev
   ```

2. Deploy the frontend to Firebase Hosting:
   ```bash
   cd frontend
   npm run build
   firebase deploy --only hosting
   ```

The application will be available at:
- Frontend: https://collegebot-dev-52f43.web.app
- Backend: https://backend-859016258149.us-central1.run.app

## Authentication Setup

### Setting up Google Auth

1. Go to Firebase Console > Authentication > Sign-in method
2. Enable Google authentication
3. Add authorized domains:
   - localhost
   - collegebot-dev-52f43.web.app

### Creating Admin Users

To create an admin user:

1. Make sure you have the Firebase service account credentials:
   ```bash
   cd backend
   source .env  # Load environment variables
   ```

2. Run the admin creation script:
   ```bash
   node scripts/create-admin.js your-email@gmail.com
   ```

## Managing Firestore Data

### Local Development (Emulator)
1. Start the Firebase emulators
2. Open http://localhost:4000/firestore in your browser
3. Use the Firestore Emulator UI to:
   - Browse collections and documents
   - Add/edit/delete data
   - Run queries
   - Monitor realtime updates

### Production
1. Go to https://console.firebase.google.com/project/collegebot-dev/firestore
2. Click on "Data" in the left sidebar to:
   - Browse collections and documents
   - Use the query bar for simple queries
   - Export/import data
   - Monitor usage

3. Use "Rules Playground" to:
   - Test security rules
   - Simulate user access
   - Debug permissions

### Data Structure

The application uses the following Firestore collections:

- `users`: User profiles and roles
  ```javascript
  {
    email: string,
    role: 'admin' | 'user',
    createdAt: timestamp
  }
  ```

- `students`: Student data per user
  ```javascript
  {
    // Student preferences and data
    createdAt: timestamp,
    updatedAt: timestamp
  }
  ```

## Environment Setup

The application uses different environment configurations for development and production:

### Frontend Environment Files

- `.env.development` - Local development settings
  ```
  VITE_API_URL=http://localhost:3001
  ```

- `.env.production` - Production settings
  ```
  VITE_API_URL=https://backend-859016258149.us-central1.run.app
  ```

### Testing Production Backend Locally

If you want to test the frontend locally but use the production backend:

```bash
cd frontend
NODE_ENV=production npm run dev
```

## Environment Variables

### Backend
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Winston log level (default: info)
- `GOOGLE_CLOUD_PROJECT` - GCP project ID for Cloud Logging
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `GOOGLE_API_KEY` - Google API key for Maps and Search
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `GOOGLE_CSE_ID` - Google Custom Search Engine ID
- `FIREBASE_CREDENTIALS` - Base64 encoded Firebase service account JSON

### Frontend
- `VITE_API_URL` - Backend API URL
- `VITE_FIREBASE_*` - Firebase configuration variables

## Firebase Emulators

The following emulators are configured:
- Authentication: Port 9099
- Firestore: Port 8080
- Hosting: Port 5001 (may fall back to 5002)

## Troubleshooting

### Common Issues

1. **Backend build failing**: Make sure you're in the project root when building the Docker image
2. **Frontend proxy errors**: Check that the backend is running and VITE_API_URL is set correctly
3. **Firestore permission denied**: Ensure you're authenticated with Firebase (`firebase login`)
4. **Docker push failing**: Run `gcloud auth configure-docker` and ensure you're authenticated
5. **Google Auth not working**: Check authorized domains in Firebase Console
6. **Admin access denied**: Verify user has admin claims set using create-admin script

### Useful Commands

- Check backend logs in Cloud Run:
  ```bash
  gcloud run services logs read backend --project collegebot-dev
  ```

- Check Firebase deployment status:
  ```bash
  firebase deploy --only hosting:collegebot-dev-52f43 --dry-run
  ```

- View Firestore data in emulator:
  ```bash
  firebase emulators:start
  # Open http://localhost:4000/firestore
  ```
