#!/bin/bash
set -e

# ============================================================================
# Production Rollback Script
# ============================================================================
# This script allows you to quickly rollback to a previous Cloud Run revision
# in case of issues with the current deployment.
# ============================================================================

# Configuration
PROJECT_ID="collegebot-dev-52f43"
REGION="us-central1"
SERVICE_NAME="backend"

echo "⚠️  PRODUCTION ROLLBACK"
echo "================================================"
echo "Project: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "================================================"
echo ""

# Show recent revisions
echo "📋 Recent revisions (most recent first):"
echo "================================================"
gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --limit=10 \
  --format="table(name,status.conditions.status[0],spec.containers[0].image.split('/')[-1],metadata.creationTimestamp)"

echo ""
echo "Current traffic routing:"
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="table(status.traffic.revisionName,status.traffic.percent)"

echo ""
echo "================================================"
echo ""

# Prompt for revision to rollback to
read -p "Enter revision name to rollback to (or 'cancel' to abort): " REVISION_NAME

if [ "$REVISION_NAME" = "cancel" ] || [ -z "$REVISION_NAME" ]; then
    echo "❌ Rollback cancelled."
    exit 0
fi

# Verify revision exists
REVISION_EXISTS=$(gcloud run revisions describe $REVISION_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(metadata.name)" 2>/dev/null || echo "")

if [ -z "$REVISION_EXISTS" ]; then
    echo "❌ Error: Revision '$REVISION_NAME' not found."
    exit 1
fi

# Confirm rollback
echo ""
read -p "⚠️  Rollback to revision '$REVISION_NAME'? This will route 100% traffic. (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Rollback cancelled."
    exit 0
fi

# Route 100% traffic to specified revision
echo ""
echo "🔄 Rolling back to revision: $REVISION_NAME"
gcloud run services update-traffic $SERVICE_NAME \
  --to-revisions=$REVISION_NAME=100 \
  --region=$REGION \
  --project=$PROJECT_ID

echo ""
echo "✅ Rollback complete!"
echo ""

# Show new traffic routing
echo "Current traffic routing:"
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="table(status.traffic.revisionName,status.traffic.percent)"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.url)")

echo ""
echo "================================================"
echo "Verify the rollback:"
echo "  Backend: $BACKEND_URL"
echo "  Health check: ${BACKEND_URL}/api/health"
echo ""
echo "Monitor logs:"
echo "  gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo "================================================"
echo ""
