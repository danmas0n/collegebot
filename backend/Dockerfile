# Use Node.js 20 as the base image
FROM node:20-slim

# Set working directory
WORKDIR /workspace

# Copy package files first for better caching
COPY backend/package*.json ./backend/
COPY mcp/student-data-server/package*.json ./mcp/student-data-server/
COPY mcp/college-data-server/package*.json ./mcp/college-data-server/

# Copy source code
COPY backend/ ./backend/
COPY mcp ./mcp

# Install and build backend
WORKDIR /workspace/backend
RUN npm install && npm run build

# Install and build student-data-server
WORKDIR /workspace/mcp/student-data-server
RUN npm install && npm run build

# Install and build college-data-server
WORKDIR /workspace/mcp/college-data-server
RUN npm install && npm run build

# Return to backend directory
WORKDIR /workspace/backend

# Expose port 3001
EXPOSE 3001

# Start the server
CMD ["npm", "start"] 