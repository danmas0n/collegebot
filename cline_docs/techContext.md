# Technical Context

## Technology Stack

### Frontend
- React with TypeScript
- Vite for build tooling
- Material-UI for components
- Firebase SDK for authentication
- Hosted on Firebase Hosting

### Backend
- Node.js with Express
- TypeScript
- Firebase Admin SDK
- Containerized with Docker
- Hosted on Cloud Run

### Database
- Firebase Firestore
- Collections:
  - admin_users
  - whitelisted_users
  - users
- Security rules implemented for access control

### Authentication
- Firebase Authentication
- Google Sign-In
- Role-based access control (admin/whitelisted users)

## Deployment Configuration

### Frontend Deployment
- URL: https://collegebot-dev-52f43.web.app
- Hosting: Firebase Hosting
- Environment:
  - Production API URL points to Cloud Run backend
  - Firebase config for authentication and Firestore

### Backend Deployment
- URL: https://backend-859016258149.us-central1.run.app
- Platform: Google Cloud Run
- Region: us-central1
- Container: Linux/AMD64 Docker image
- Environment Variables:
  - NODE_ENV=production
  - Various API keys and service credentials

### Database Configuration
- Firestore in Native mode
- Region: us-central1
- Security rules deployed for:
  - Admin access control
  - Whitelist verification
  - User data protection

## Development Setup
- Local development uses Firebase emulators
- Environment variables managed through .env files
- Docker for containerization
- TypeScript for type safety

## Monitoring
- Cloud Run dashboard for backend metrics
- Firebase Console for frontend and auth
- Firestore Console for database
- Structured logging with Winston
