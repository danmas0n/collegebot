# CollegeBot

An AI-powered web application that helps students and families make informed college choices by analyzing Common Data Set (CDS) information.

## Project Structure

```
collegebot/
├── frontend/           # React frontend application
├── backend/           # Express.js backend server
├── mcp/              # Model Context Protocol servers
│   └── college-data-server/  # College data search and analysis
└── README.md
```

## Features

- Search for colleges and their Common Data Sets
- View detailed college information from CDS files
- Compare multiple colleges
- AI-powered analysis and recommendations

## Setup

1. Install dependencies:
```bash
# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd backend && npm install

# Install MCP server dependencies
cd mcp/college-data-server && npm install
```

2. Build the MCP server:
```bash
cd mcp/college-data-server && npm run build
```

3. Start the development servers:
```bash
# Start the backend server
cd backend && npm start

# In a new terminal, start the frontend
cd frontend && npm run dev
```

4. Open http://localhost:3000 in your browser

## Development

- Frontend: React with Material-UI, running on Vite
- Backend: Express.js server with MCP integration
- MCP Servers: TypeScript-based servers for specialized functionality
  - college-data-server: Searches and analyzes Common Data Set information
  - memory: Stores and manages application state
  - fetch: Handles external API requests

## License

MIT
