FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Copy storage directory with CDS data
COPY storage/ ./storage/

# Build TypeScript
RUN npm run build

CMD ["node", "build/index.js"]
