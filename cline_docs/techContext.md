# Technical Context

## Development Environment

### Frontend
- React with TypeScript
- Vite for build tooling
- Key dependencies:
  - Firebase for authentication
  - React Router for navigation
  - Material-UI for components
  - Leaflet for maps

### Backend
- Node.js with Express
- TypeScript for type safety
- Key dependencies:
  - Firebase Admin SDK
  - Firebase Functions
  - Model Context Protocol (MCP) for extensibility

### Database
- Firebase Firestore
  - Collections structured for student data, map locations, chats
  - Real-time capabilities
  - Security rules for access control

### Development Tools
- Firebase Emulators for local development
  - Authentication emulator on port 9099
  - Firestore emulator on port 8080
- VSCode as primary IDE
- Git for version control

## Technical Constraints

### Authentication
- Firebase Authentication required for all protected routes
- Custom middleware for role-based access
- Token-based authentication with Firebase ID tokens

### Data Storage
- Firestore document size limits (1MB per document)
- Collection-based data organization
- Atomic operations for data consistency

### API Limitations
- Rate limiting on Firebase services
- Payload size restrictions
- Cross-origin resource sharing (CORS) configuration

### Development Workflow
- Local development with Firebase emulators
- TypeScript compilation requirements
- Environment variable management

## Technical Decisions

### Map Location Storage
- Separate map_locations collection for better querying
- Metadata field for rich location data
- Student ID association for data ownership

### Authentication Flow
- Firebase Authentication for user management
- Custom claims for role-based access
- Middleware for route protection

### State Management
- React Context for global state
- Props for component-level state
- Firestore for persistence
- MCP for extensible functionality
