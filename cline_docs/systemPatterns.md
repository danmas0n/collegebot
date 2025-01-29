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

### API Design
- RESTful endpoints with Express
- Protected routes requiring authentication
- MCP servers for specialized operations
  - college-data: College information and search
  - claude-docs: Documentation access
  - fetch: HTTP requests
  - memory: Knowledge graph operations

## Frontend Architecture

### React Components
- Modular component structure
- Stage-based wizard flow
- Context providers for state management
  - AuthContext: User authentication state
  - ChatContext: Chat interactions
  - ClaudeContext: AI assistant state
  - WizardContext: Application flow state

### Data Flow
- API utilities for backend communication
- Type-safe interfaces
- Centralized error handling

## Development Patterns

### Code Organization
- Feature-based directory structure
- Clear separation of concerns
- TypeScript for type safety
- Consistent error handling

### State Management
- React Context for global state
- Props for component-level state
- Firestore for persistence

### Testing
- Firebase emulators for local development
- Manual testing workflow
- Console logging for debugging

### Deployment
- Firebase hosting
- Environment-based configuration
- Continuous development workflow
