# CollegeBot

A web application that helps students find and evaluate colleges that match their preferences and requirements. The application includes features for college research, map visualization, calendar planning, and task management to assist students throughout the college application process.

## License

This project is licensed under the Apache License 2.0 with Commons Clause - see the [LICENSE](LICENSE) file for details.

This means you can:
- Use the software privately
- Modify the software
- Distribute the software for non-commercial purposes
- Use the software for personal educational purposes

But you cannot:
- Sell the software
- Use the software in a commercial service
- Offer hosting or consulting services based primarily on this software

## Features

- **Student Profile Management**: Create and manage student profiles with academic information, interests, and preferences
- **College Research**: AI-powered research to find colleges matching student preferences
- **Interactive Map**: Visualize colleges and scholarships on a map with detailed information
- **Calendar & Tasks**: Track application deadlines and manage college application tasks
- **Recommendations**: Get personalized college recommendations based on student profile
- **Admin Panel**: Manage users, AI settings, and application data

## Recent Updates

### College Tour Planning
- Added a new feature to plan college tours based on map locations
- Integrated with Google Maps for route planning and navigation
- Implemented college selection from map pins
- Added transportation mode selection (driving, walking, transit, bicycling)
- Provided option to open routes directly in Google Maps

### Automatic Chat Processing
- Enhanced Map functionality to automatically process unprocessed chats when the Map tab becomes visible
- Implemented debug panel display during processing
- Added visual feedback with progress indicators
- Improved user experience by showing processing status in real-time

### New Backend Routes
- Added calendar.ts route for managing calendar items
- Created tasks.ts route for managing tasks
- Implemented pin-research.ts route for researching college deadlines and requirements
- Enhanced backend API to support new calendar and task management features

### XLSX to PDF Conversion
- Added support for converting Excel (.xlsx) files to PDF format in the college-data-server
- Implemented solution addresses compatibility issues with the Gemini API
- Uses ExcelJS for reading Excel files and PDFKit for generating PDF output
- Preserves tabular structure and formatting for better AI processing

### Map Processing Improvements
- Enhanced chat history processing for map location extraction:
  - Restructured to treat chat history as reference data rather than continuing conversations
  - Improved state management to prevent duplicate tool calls
  - Added detailed logging for debugging tool execution
  - Modified prompts to provide more explicit instructions for processing locations sequentially
  - Added stronger type checking and error handling

## Project Structure

```
collegebot/
├── backend/         # Express.js backend
│   ├── src/         # Source code
│   │   ├── routes/  # API routes
│   │   ├── services/# Service implementations including geocoding and map locations
│   │   ├── prompts/ # AI prompt templates
│   │   └── utils/   # Utility functions
├── frontend/        # React frontend
│   ├── src/         # Source code
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions
├── mcp/             # Model Context Protocol services
│   └── college-data-server/  # College data service with CDS extraction
├── firestore.rules  # Firestore security rules
└── firebase.json    # Firebase configuration
```

### MCP Services

The application uses the Model Context Protocol (MCP) to enable AI models to access structured data:

#### college-data-server
- Provides access to Common Data Set (CDS) information for colleges
- Implements tools for searching college data using Google Custom Search API
- Extracts structured information from PDF and Excel files using Gemini
- Recently enhanced with XLSX to PDF conversion for compatibility with AI models
- Caches processed data for improved performance
- Supports processing of both PDF and Excel-format CDS data files

### Backend Services

The backend implements several key services to support the application:

- **Authentication Middleware**: Validates JWT tokens and enforces access control
- **Firestore Integration**: CRUD operations for all application data
- **AI Service Factory**: Dynamically selects AI service (Claude/Gemini) based on settings
- **Map Services**: 
  - Handles geocoding of addresses to coordinates
  - Manages college and scholarship locations
  - Includes analysis of preference matching and fit issues
  - Recently enhanced with improved chat processing for more reliable extraction
- **Tools System**:
  - Implements a structured tool execution framework
  - Handles detection and parsing of tool calls from AI responses
  - Supports comprehensive logging for debugging
  - Maintains conversation state for stateful interactions
- **Research Services**: Processes chat content for insights and extracts research tasks
- **Student Data Services**: Manages student profiles and preference data

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
  - URL: https://backend-75043580028.us-central1.run.app

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
   ```bash
   cd frontend
   npm run build
   firebase deploy --only hosting
   ```

2. **Backend Deployment**:
   ```bash
   # From project root
   # Build and push the Docker image
   docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend -f backend/Dockerfile .
   docker push us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend

   # Deploy to Cloud Run with environment variables
   gcloud run deploy backend \
     --image us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend \
     --platform managed \
     --region us-central1 \
     --project collegebot-dev-52f43 \
     --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=collegebot-dev-52f43,GOOGLE_CLOUD_PROJECT=collegebot-dev-52f43,FIREBASE_CREDENTIALS_FILE=/workspace/backend/service-account.json

   # Configure IAM policy to allow unauthenticated access (required for CORS)
   cat > policy.yaml << EOL
   bindings:
   - members:
     - allUsers
     role: roles/run.invoker
   EOL

   gcloud run services set-iam-policy backend policy.yaml --region us-central1 --project collegebot-dev-52f43
   ```

3. **Database Setup**:
   a. Create Firestore Database:
      - Go to Google Cloud Console > Firestore
      - Click "Create Database"
      - Choose "Native Mode"
      - Select region (us-central1 recommended)
      - Click "Enable"

   b. Deploy Security Rules:
      ```bash
      firebase deploy --only firestore:rules
      ```

   c. Initialize Collections:
      ```bash
      cd scripts
      npm install
      node init-firestore.js  # Creates initial collections
      node create-admin-prod.js  # Sets up admin user
      ```

4. **Environment Variables**:
   - Backend Cloud Run requires:
     ```
     NODE_ENV=production
     FIREBASE_PROJECT_ID=collegebot-dev-52f43
     FIREBASE_CREDENTIALS_FILE=/workspace/backend/service-account.json
     GOOGLE_CLOUD_PROJECT=collegebot-dev-52f43
     CLAUDE_API_KEY=your_claude_api_key
     CLAUDE_MODEL=claude-3-7-sonnet-20250219
     GEMINI_API_KEY=your_gemini_api_key
     GEMINI_MODEL=gemini-2.0-flash
     GOOGLE_MAPS_API_KEY=your_maps_api_key
     ```

## Key Components

### Map Visualization

The Map stage provides an interactive visualization of colleges and scholarships:

- **Interactive Google Map**: Displays colleges and scholarships as markers
- **Detailed Information**: Shows comprehensive details about each location including:
  - College information: acceptance rates, costs, merit scholarships
  - Scholarship information: amounts, deadlines, eligibility
  - Reference links to official websites and resources
- **Location List**: Sortable list of all locations with filtering options
- **Visual Indicators**: Special badges for locations with reference links
- **Automated Processing**: AI-powered chat analysis to extract colleges and scholarships mentioned in conversations:
  - Extracts college and scholarship information from chat history
  - Geocodes addresses to get precise coordinates
  - Adds locations to the map with comprehensive metadata
  - Identifies potential fit issues (financial, academic, location)
  - Detects match with student preferences
  - Creates consistent and structured location data

### Calendar & Tasks

The Calendar stage helps students manage college application deadlines and plan college tours:

- **Calendar View**: Visual representation of important dates and deadlines
- **Task Management**: Create and track tasks for college applications and scholarships
- **Integration**: Tasks can be created from research findings
- **College Tour Planning**: Plan routes to visit multiple colleges on the map
  - Select colleges from map pins
  - Choose transportation mode (driving, walking, transit, bicycling)
  - View optimized routes between selected colleges
  - Open routes directly in Google Maps for navigation
- **Pin Research**: Research college deadlines and requirements
  - Automatically extract application deadlines
  - Identify scholarship opportunities
  - Create tasks and calendar items from research findings
- **Automatic Processing**: Process unprocessed chats when the Map tab becomes visible
  - Show debug panel during processing
  - Display progress indicators
  - Provide real-time feedback on processing status

### AI Service Configuration

The application supports both Claude and Gemini AI services. AI settings are managed through the admin panel and stored in Firestore:

1. **Settings Management**:
   - Access the admin panel through the app
   - Navigate to "AI Settings" tab
   - Configure:
     - Service type (Claude/Gemini)
     - Model name
     - API keys

2. **Environment Variables**:
   - Environment variables serve as fallbacks if Firestore settings are not available
   - Required variables in `.env` or Cloud Run:
     ```
     AI_SERVICE_TYPE=claude # or gemini
     CLAUDE_MODEL=claude-3-7-sonnet-20250219
     CLAUDE_API_KEY=your_claude_api_key_here
     GEMINI_MODEL=gemini-2.0-flash
     GEMINI_API_KEY=your_gemini_api_key_here
     ```

3. **Firestore Settings**:
   - Collection: `settings`
   - Document: `ai`
   - Fields:
     ```typescript
     {
       id: string;
       serviceType: 'claude' | 'gemini';
       model: string;
       claudeApiKey?: string;
       geminiApiKey?: string;
       updatedAt: Timestamp;
       updatedBy: string;
     }
     ```

### Authentication Setup

1. Go to Firebase Console > Authentication > Sign-in method
2. Enable Google authentication
3. Add authorized domains:
   - localhost
   - collegebot-dev-52f43.web.app

### Managing Firestore Data

#### Production Setup
1. Create Firestore database in Google Cloud Console
2. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Initialize collections:
   ```bash
   cd scripts
   node init-firestore.js
   ```
4. Create admin user:
   ```bash
   node create-admin-prod.js
   ```

#### Security Rules
- Deploy updated rules with:
  ```bash
  firebase deploy --only firestore:rules
  ```
- Rules control access for:
  - Admin users collection
  - Whitelisted users collection
  - User data

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

## Environment Setup

The application uses different environment configurations for development and production:

### Frontend Environment Files

- `.env.development` - Local development settings
  ```
  VITE_API_URL=http://localhost:3001
  ```

- `.env.production` - Production settings
  ```
  VITE_API_URL=https://backend-75043580028.us-central1.run.app
  ```

### Testing Production Backend Locally

If you want to test the frontend locally but use the production backend:

```bash
cd frontend
NODE_ENV=production npm run dev
```

## Firebase Emulators

The following emulators are configured:
- Authentication: Port 9099
- Firestore: Port 8080
- Hosting: Port 5001 (may fall back to 5002)

## Troubleshooting

### Common Issues

1. **Backend build failing**: Make sure you're in the project root when building the Docker image
2. **Frontend proxy errors**: Check that the backend is running and VITE_API_URL is set correctly
3. **Firestore permission denied**: Ensure security rules are deployed and user has correct permissions
4. **Docker push failing**: Run `gcloud auth configure-docker` and ensure you're authenticated
5. **Google Auth not working**: Check authorized domains in Firebase Console
6. **Admin access denied**: Verify user has admin claims set using create-admin script
7. **Firestore "NOT_FOUND" error**: Ensure Firestore database is created in Google Cloud Console
8. **CORS errors**: Ensure Cloud Run service allows unauthenticated access and CORS is properly configured in backend

### Useful Commands

- Check backend logs in Cloud Run:
  ```bash
  gcloud run services logs read backend --project collegebot-dev-52f43
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

- Check Cloud Run IAM policy:
  ```bash
  gcloud run services get-iam-policy backend --region us-central1 --project collegebot-dev-52f43
