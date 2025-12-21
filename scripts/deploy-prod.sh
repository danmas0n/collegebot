#!/bin/bash
set -e

# ============================================================================
# Production Deployment Script for counseled.app
# ============================================================================
# This script deploys both backend and frontend to the production environment
# using the existing collegebot-dev-52f43 Firebase/GCP project.
#
# The production site will be accessible at:
# - https://counseled.app (once custom domain is configured)
# - https://collegebot-dev-52f43.web.app (Firebase default)
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Firebase CLI installed and authenticated
# - Docker installed and running
# - Production environment variables configured in Cloud Run
# ============================================================================

# Configuration
PROJECT_ID="collegebot-dev-52f43"
REGION="us-central1"
SERVICE_NAME="backend"
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/backend/backend:latest"

echo "🚀 Starting production deployment..."
echo "================================================"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "================================================"
echo ""

# Confirmation prompt
read -p "⚠️  This will deploy to PRODUCTION. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled."
    exit 0
fi

# ============================================================================
# STEP 1: Deploy Backend to Cloud Run
# ============================================================================
echo ""
echo "📦 Step 1/3: Building and deploying backend..."
echo "================================================"

# Ensure we're using the correct GCP project
gcloud config set project $PROJECT_ID

# Build Docker image for linux/amd64
echo "  → Building Docker image..."
docker build --platform linux/amd64 -t $IMAGE_NAME -f backend/Dockerfile .

# Push to Artifact Registry
echo "  → Pushing to Artifact Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run (no traffic initially for safety)
echo "  → Deploying to Cloud Run (no traffic initially)..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --no-traffic \
  --allow-unauthenticated \
  --timeout=1800

echo ""
echo "✅ Backend deployed successfully (no traffic routed yet)"
echo ""

# Get the new revision name
NEW_REVISION=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.latestCreatedRevisionName)")

echo "  → New revision: $NEW_REVISION"
echo ""

# Prompt to test the revision before routing traffic
read -p "Test the new revision before routing traffic? (yes/no): " test_revision
if [ "$test_revision" = "yes" ]; then
    REVISION_URL=$(gcloud run revisions describe $NEW_REVISION \
      --region $REGION \
      --project $PROJECT_ID \
      --format="value(status.url)")

    echo ""
    echo "Test the new revision at:"
    echo "  Health check: ${REVISION_URL}/api/health"
    echo ""
    read -p "Press Enter when ready to route traffic to the new revision..."
fi

# Route 100% traffic to new revision
echo "  → Routing 100% traffic to new revision..."
gcloud run services update-traffic $SERVICE_NAME \
  --to-latest \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "✅ Traffic routed to new backend revision"
echo ""

# ============================================================================
# STEP 2: Deploy Frontend to Firebase Hosting
# ============================================================================
echo ""
echo "🏗️  Step 2/3: Building and deploying frontend..."
echo "================================================"

cd frontend

# Install dependencies
echo "  → Installing dependencies..."
npm install

# Build for production
echo "  → Building frontend (using .env.production)..."
npm run build

# Deploy to Firebase Hosting
echo "  → Deploying to Firebase Hosting..."
firebase deploy --only hosting --project $PROJECT_ID

cd ..

echo ""
echo "✅ Frontend deployed successfully"
echo ""

# ============================================================================
# STEP 3: Verify Deployment
# ============================================================================
echo ""
echo "🔍 Step 3/3: Verifying deployment..."
echo "================================================"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.url)")

echo "  → Backend URL: $BACKEND_URL"
echo "  → Frontend URL: https://collegebot-dev-52f43.web.app"
echo "  → Custom domain: https://counseled.app (if configured)"
echo ""

# Test backend health
echo "  → Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s "${BACKEND_URL}/api/health" || echo "ERROR")

if [ "$HEALTH_RESPONSE" = "ERROR" ]; then
    echo "    ⚠️  Warning: Could not reach backend health endpoint"
else
    echo "    ✅ Backend health check passed"
fi

# ============================================================================
# Deployment Summary
# ============================================================================
echo ""
echo "================================================"
echo "✨ Production deployment complete!"
echo "================================================"
echo ""
echo "📊 Deployment Summary:"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: https://collegebot-dev-52f43.web.app"
if [ -f "frontend/.firebase/hosting.*.cache" ]; then
    echo "            https://counseled.app (if custom domain configured)"
fi
echo ""
echo "🔍 Next Steps:"
echo "  1. Test the production site thoroughly"
echo "  2. Monitor Cloud Run logs: gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo "  3. Configure custom domain in Firebase Console (if not done)"
echo "  4. Verify Stripe webhooks are working"
echo ""
echo "⚠️  Important:"
echo "  - Production Stripe keys should be configured in Cloud Run env vars"
echo "  - Run: ./scripts/update-backend-env-prod.sh if not configured yet"
echo ""
echo "🔙 To rollback: ./scripts/rollback-prod.sh"
echo ""
