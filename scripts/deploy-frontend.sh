#!/bin/bash
# Script to build and deploy the frontend for CollegeBot

set -e  # Exit immediately if a command exits with a non-zero status

echo "===== Starting Frontend Deployment ====="

# Navigate to frontend directory
cd frontend

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Build the frontend
echo "Building frontend..."
npm run build

# Deploy to Firebase hosting
echo "Deploying to Firebase hosting..."
firebase deploy --only hosting

echo "===== Frontend Deployment Complete ====="
echo "Frontend URL: https://collegebot-dev-52f43.web.app"
