# System Architecture Patterns

## Backend Architecture

### Authentication & Authorization
- Firebase Authentication for user management
- Custom middleware for route protection
- Role-based access control (admin vs regular users)

### Data Storage
- Firestore for main data storage
  - Collections:
    - students: Student profiles and data
    - map_locations: College and scholarship locations
    - chats: Student-specific chat history
    - whitelisted-users: Access control
    - admin-users: Admin user management
    - user-chats: User chat threads and messages

### AI Service Architecture
- Factory pattern for AI service instantiation
- Service-agnostic interface
  - Common methods across providers
  - Unified response format
  - Standardized error handling
- Supported providers:
  - Claude: Anthropic's language model
  - Gemini: Google's language model
- Environment-based configuration
  - Service selection via environment variables
  - API key management in backend only
- Streaming support
  - SSE for real-time responses
  - Consistent event types across providers
  - Unified error handling

### API Design
- RESTful endpoints with Express
- Protected routes requiring authentication
- Chat endpoints:
  - GET /api/chat/chats: List student chats
  - POST /api/chat/chats: Save chat
  - DELETE /api/chat/chats/:id: Delete chat (with ownership verification)
  - POST /api/chat/message: Send message (with streaming response)
  - POST /api/chat/analyze: Analyze chat history
- MCP servers for specialized operations
  - college-data: College information and search
  - claude-docs: Documentation access
  - fetch: HTTP requests
  - memory: Knowledge graph operations
  - student-data: Map and location operations (via Firestore)
    - geocode: Convert addresses to coordinates
    - create_map_location: Add new map locations
    - get_map_locations: Retrieve student's map locations
    - clear_map_locations: Remove all locations for a student

### Map Location Management
- Direct Firestore integration for map operations
- Secure access through userId validation
- Geocoding via Google Maps API
- Location data structure:
  - studentId: Links location to student
  - name: Location identifier
  - latitude/longitude: Coordinates
  - formattedAddress: Full address
  - metadata: Additional location data
- Operations secured by:
  - User authentication
  - Student ownership verification
  - Role-based access control

### Authentication Flow
- Frontend:
  - api utility wraps all HTTP requests
  - getAuthHeaders adds Bearer token to requests
  - Automatic token refresh via Firebase
- Backend:
  - Auth middleware verifies Bearer tokens
  - Student ownership verification for chat operations
  - Role-based access for admin operations

## Frontend Architecture

### React Components
- Modular component structure
- Stage-based wizard flow
- Context providers for state management
  - AuthContext: User authentication state
  - ChatContext: Chat interactions
  - WizardContext: Application flow state

### Data Flow
- API utilities for backend communication
- Type-safe interfaces
- Centralized error handling
- Service-agnostic chat interactions

## Development Patterns

### Code Organization
- Feature-based directory structure
- Clear separation of concerns
- TypeScript for type safety
- Consistent error handling
- Service abstraction layers

### State Management
- React Context for global state
- Props for component-level state
- Firestore for persistence

### Logging Strategy
- Hybrid approach using both Winston and console.logs
- Winston logger with multiple transports:
  - Console transport for development
  - File transport for local logs
  - Cloud Logging transport for production
- Console.logs maintained for development:
  - Frontend: Browser dev tools visibility
  - Backend: Terminal visibility
- Gradual migration path:
  - Keep existing console.logs
  - Add Cloud Logging to Winston
  - Migrate console.logs to Winston as code is touched

### Testing
- Firebase emulators for local development
- Manual testing workflow
- Comprehensive logging for debugging

### Deployment
- Firebase hosting
- Environment-based configuration
- Continuous development workflow
- Service-specific configuration management
