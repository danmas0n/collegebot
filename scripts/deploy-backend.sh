#!/bin/bash
# Script to build and deploy the backend and database for CollegeBot

set -e  # Exit immediately if a command exits with a non-zero status

echo "===== Starting Backend Deployment ====="

# Build and push the Docker image
echo "Building Docker image..."
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend -f backend/Dockerfile .

echo "Pushing Docker image to registry..."
docker push us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend

# Deploy to Cloud Run with environment variables (without traffic initially)
echo "Deploying new revision to Cloud Run..."
gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend \
  --platform managed \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --no-traffic \
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=collegebot-dev-52f43,GOOGLE_CLOUD_PROJECT=collegebot-dev-52f43,FIREBASE_CREDENTIALS_FILE=/workspace/backend/service-account.json

# Route 100% traffic to the new revision
echo "Routing traffic to new revision..."
gcloud run services update-traffic backend --to-latest --region us-central1 --project collegebot-dev-52f43

# Configure IAM policy to allow unauthenticated access (required for CORS)
#echo "Configuring IAM policy..."
#cat > policy.yaml << EOL
#bindings:
#- members:
#  - allUsers
#  role: roles/run.invoker
#EOL

#gcloud run services set-iam-policy backend policy.yaml --region us-central1 --project collegebot-dev-52f43

# Deploy Firestore rules
#echo "Deploying Firestore rules..."
#firebase deploy --only firestore:rules

echo "===== Backend Deployment Complete ====="
echo "Backend URL: https://backend-75043580028.us-central1.run.app"
