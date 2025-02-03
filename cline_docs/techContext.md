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
  - AI Service providers (Claude, Gemini)

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
- AI service-specific rate limits and quotas

### Development Workflow
- Local development with Firebase emulators
- TypeScript compilation requirements
- Environment variable management
- Service-specific API keys and credentials

## Technical Decisions

### AI Service Architecture
- Service-agnostic design using Factory pattern
- Pluggable AI services (Claude, Gemini)
- Common interface for all AI providers
- Environment-based service selection
- Backend-only API key management

### Firebase Configuration
- Development mode uses emulators
- Production uses service account credentials
- Base64-encoded service account key
- Environment-specific initialization
- Secure credential management

### Map Location Storage
- Separate map_locations collection for better querying
- Metadata field for rich location data
- Student ID association for data ownership
- Direct Firestore operations for:
  - Location creation and deletion
  - Batch operations (clear all)
  - Student-specific queries
- Google Maps API integration for geocoding
- Security rules enforcing:
  - User authentication
  - Student ownership
  - Data validation

### Map Operations Architecture
- Student-data tools implemented directly in Firestore:
  - geocode: Uses Google Maps API
  - create_map_location: Direct Firestore write
  - get_map_locations: Firestore query with ownership check
  - clear_map_locations: Batch delete operation
- User authentication and authorization:
  - userId passed through service chain
  - Student ownership verification
  - Role-based access control
- Error handling:
  - Input validation
  - API error handling
  - Security rule violations

### Authentication Flow
- Firebase Authentication for user management
- Custom claims for role-based access
- Middleware for route protection
- Frontend authentication:
  - api utility for consistent auth header injection
  - Automatic token refresh handling
  - Bearer token format for all requests
- Backend authentication:
  - Token verification middleware
  - Student ownership validation for chat operations
  - Role-based access control enforcement

### Chat System Architecture
- RESTful endpoints for chat operations:
  - /api/chat/chats for chat management
  - /api/chat/message for message handling
  - /api/chat/analyze for chat analysis
- Student-specific chat ownership
- Firestore for chat persistence
- SSE for real-time message streaming
- Error handling with appropriate status codes

### State Management
- React Context for global state
- Props for component-level state
- Firestore for persistence
- MCP for extensible functionality

### Logging Infrastructure
- Winston logger for structured logging
  - Console transport with colorization
  - File transport for local development
  - Cloud Logging transport for production
- Environment-based configuration
  - Development: Console + File logging
  - Production: Console + Cloud Logging
- Log levels and metadata
  - Default level: info
  - Structured JSON format
  - Automatic metadata injection (timestamp, service, environment)
- Specialized loggers
  - Base logger for general application logs
  - AI service loggers for provider interactions
- Local Development
  - Log files in backend/logs/
  - Real-time console output
  - Separate files for different concerns (combined, error, ai-service)
- Production Monitoring
  - Google Cloud Logging integration
  - Centralized log management
  - Advanced filtering and search
  - Log-based metrics and alerts
