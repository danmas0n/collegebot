# Production Deployment Guide - counseled.app

## Overview

This guide covers deploying the collegebot application to production at **counseled.app** using the existing `collegebot-dev-52f43` Firebase/GCP project. This is a simplified single-environment approach where the production domain is added to the existing infrastructure.

## Architecture

- **Production Domain**: `counseled.app`
- **Firebase Project**: `collegebot-dev-52f43` (shared with development)
- **Backend**: Cloud Run service in `us-central1`
- **Frontend**: Firebase Hosting
- **Database**: Firestore (shared)
- **Stripe**: Production keys (live mode)

## Prerequisites

Before deploying to production, ensure you have:

- [ ] Domain `counseled.app` purchased
- [ ] `gcloud` CLI installed and authenticated
- [ ] `firebase` CLI installed and authenticated
- [ ] Docker installed and running
- [ ] Access to production Stripe keys
- [ ] Access to production API keys (Claude, Google, etc.)

## One-Time Setup

### 1. Configure Custom Domain in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `collegebot-dev-52f43`
3. Navigate to **Hosting** → **Add custom domain**
4. Enter domain: `counseled.app` (no www)
5. Follow the verification steps provided
6. Firebase will display DNS records to add to your domain registrar

### 2. Update DNS Records

1. Log in to your domain registrar (where you purchased counseled.app)
2. Go to DNS settings
3. Add the A records provided by Firebase:
   ```
   Type: A
   Name: @ (or leave blank)
   Value: [IP addresses from Firebase]
   TTL: 3600 (or default)
   ```
4. Save DNS changes
5. Wait for DNS propagation (can take up to 48 hours, usually 1-24 hours)

### 3. Wait for SSL Certificate

Firebase automatically provisions an SSL certificate for your custom domain. This process:
- Starts after DNS verification
- Usually completes within 1 hour
- Can take up to 24 hours
- Status visible in Firebase Console → Hosting → Custom domains

### 4. Configure Stripe Production Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Configure:
   - **Endpoint URL**: `https://backend-75043580028.us-central1.run.app/api/billing/webhook`
   - **Listen to**: Events on your account
   - **Select events**:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`) - you'll need this for environment variables

### 5. Set Production Environment Variables

You'll need to manually set environment variables in Cloud Run. Use the template in [backend/.env.production.template](backend/.env.production.template) as a reference for all required variables.

Set variables using gcloud:

```bash
gcloud run services update backend \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --set-env-vars "\
NODE_ENV=production,\
FIREBASE_PROJECT_ID=collegebot-dev-52f43,\
STRIPE_SECRET_KEY=sk_live_...,\
STRIPE_WEBHOOK_SECRET=whsec_...,\
STRIPE_PRICE_ID=price_...,\
[... add all other env vars from template ...]"
```

**Alternative**: If you have the one-time setup script locally (not in git), run: `./update-backend-env-prod.sh`

This configures:
- Production Stripe keys (`sk_live_...`)
- Production price ID
- Firebase/GCP project configuration
- AI service settings

## Deployment Process

### Quick Deploy

For a complete deployment (backend + frontend):

```bash
./scripts/deploy-prod.sh
```

This script will:
1. Build and push the backend Docker image
2. Deploy to Cloud Run (no traffic initially)
3. Prompt you to test the new revision
4. Route 100% traffic to the new revision
5. Build and deploy the frontend
6. Verify the deployment

### Manual Backend Deployment

If you only need to deploy the backend:

```bash
# Build and push Docker image
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend:latest \
  -f backend/Dockerfile .

docker push us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend:latest

# Deploy to Cloud Run
gcloud run deploy backend \
  --image us-central1-docker.pkg.dev/collegebot-dev-52f43/backend/backend:latest \
  --platform managed \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --no-traffic \
  --allow-unauthenticated

# Route traffic to new revision
gcloud run services update-traffic backend \
  --to-latest \
  --region us-central1 \
  --project collegebot-dev-52f43
```

### Manual Frontend Deployment

If you only need to deploy the frontend:

```bash
cd frontend
npm install
npm run build
firebase deploy --only hosting --project collegebot-dev-52f43
```

## Testing Production Deployment

### 1. Backend Health Check

```bash
curl https://backend-75043580028.us-central1.run.app/api/health
```

Expected response: `{"status":"ok","environment":"production"}`

### 2. CORS Verification

```bash
curl -H "Origin: https://counseled.app" \
  -I https://backend-75043580028.us-central1.run.app/api/health
```

Check for `Access-Control-Allow-Origin: https://counseled.app` in response headers.

### 3. Authentication Test

1. Visit `https://counseled.app`
2. Click **Sign in with Google**
3. Complete authentication flow
4. Verify successful login

### 4. Stripe Subscription Test

⚠️ **WARNING**: This will create a REAL subscription and charge a REAL credit card!

1. Sign in to counseled.app
2. Navigate to subscription page
3. Use a real credit card (not test card)
4. Complete subscription purchase
5. Verify in:
   - Stripe Dashboard → Customers
   - Firebase Console → Firestore → `subscription_users` collection
   - App shows subscription is active

### 5. Webhook Verification

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click **Send test webhook**
3. Send `customer.subscription.created` event
4. Check webhook response shows 200 OK
5. Monitor Cloud Run logs:
   ```bash
   gcloud run logs read backend --region us-central1 --project collegebot-dev-52f43 --limit 50
   ```

## Monitoring

### View Cloud Run Logs

```bash
# Recent logs
gcloud run logs read backend \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --limit 100

# Real-time logs
gcloud run logs tail backend \
  --region us-central1 \
  --project collegebot-dev-52f43

# Filter for errors
gcloud run logs read backend \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --filter="severity>=ERROR"
```

### Check Service Status

```bash
# Current deployment info
gcloud run services describe backend \
  --region us-central1 \
  --project collegebot-dev-52f43

# Traffic routing
gcloud run services describe backend \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --format="table(status.traffic.revisionName,status.traffic.percent)"
```

### Firebase Hosting Status

View hosting status and traffic in [Firebase Console](https://console.firebase.google.com/) → Hosting

## Rollback Procedure

If you encounter issues with a deployment:

```bash
./scripts/rollback-prod.sh
```

This script will:
1. Show recent Cloud Run revisions
2. Show current traffic routing
3. Prompt you to select a revision to rollback to
4. Route 100% traffic to the selected revision
5. Verify the rollback

### Manual Rollback

```bash
# List recent revisions
gcloud run revisions list \
  --service=backend \
  --region=us-central1 \
  --project=collegebot-dev-52f43 \
  --limit=10

# Rollback to specific revision
gcloud run services update-traffic backend \
  --to-revisions=backend-00042-xyz=100 \
  --region=us-central1 \
  --project=collegebot-dev-52f43
```

## Troubleshooting

### Issue: Custom domain not resolving

**Symptoms**: counseled.app doesn't load or shows "site can't be reached"

**Solutions**:
1. Check DNS propagation: `nslookup counseled.app`
2. Verify DNS records match Firebase requirements
3. Wait 24-48 hours for full propagation
4. Check domain registrar for DNS configuration errors

### Issue: SSL certificate not provisioning

**Symptoms**: Browser shows "Not Secure" or SSL errors

**Solutions**:
1. Verify DNS records are correct
2. Wait up to 24 hours for certificate provisioning
3. Check Firebase Console → Hosting → Custom domains for status
4. Ensure domain verification is complete

### Issue: CORS errors in browser console

**Symptoms**: API requests fail with CORS errors

**Solutions**:
1. Verify backend CORS includes `https://counseled.app` ([server.ts:34](backend/src/server.ts#L34))
2. Redeploy backend if CORS was recently updated
3. Clear browser cache
4. Check browser console for specific CORS error message

### Issue: Authentication fails

**Symptoms**: Can't sign in with Google

**Solutions**:
1. Verify `counseled.app` is added as authorized domain in Firebase Console → Authentication → Settings → Authorized domains
2. Check Firebase config in [frontend/.env.production](frontend/.env.production)
3. Verify Firebase project ID is correct
4. Check browser console for specific auth errors

### Issue: Stripe webhook not working

**Symptoms**: Subscriptions created but not reflected in app

**Solutions**:
1. Verify webhook endpoint URL in Stripe Dashboard
2. Check webhook signing secret matches Cloud Run env var
3. Review Cloud Run logs for webhook processing errors
4. Test webhook delivery manually in Stripe Dashboard
5. Ensure webhook events are correctly configured

### Issue: Backend crashes or errors

**Symptoms**: 500 errors, service unavailable

**Solutions**:
1. Check Cloud Run logs for error messages
2. Verify all environment variables are set correctly
3. Check service account has necessary permissions
4. Verify Docker image built successfully
5. Rollback to previous working revision

## Environment Configuration

### Backend Environment Variables

The following environment variables must be set in Cloud Run:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | `collegebot-dev-52f43` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `collegebot-dev-52f43` |
| `FIREBASE_CREDENTIALS_FILE` | Service account path | `/workspace/backend/service-account.json` |
| `AI_SERVICE_TYPE` | AI service to use | `gemini` or `claude` |
| `CLAUDE_API_KEY` | Claude API key | `sk-ant-api03-...` |
| `CLAUDE_MODEL` | Claude model | `claude-3-5-sonnet-20241022` |
| `GEMINI_API_KEY` | Gemini API key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model | `gemini-2.0-flash` |
| `GOOGLE_API_KEY` | Google API key | `AIzaSy...` |
| `GOOGLE_CSE_ID` | Custom Search Engine ID | `5279097ac0573410e` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | `AIzaSy...` |
| `STRIPE_SECRET_KEY` | Stripe secret key (live) | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `STRIPE_PRICE_ID` | Stripe price ID (live) | `price_...` |

Set these variables manually using the `gcloud run services update` command, or use the one-time setup script if available locally.

### Frontend Environment Variables

Configured in [frontend/.env.production](frontend/.env.production):

- `VITE_API_URL` - Backend URL
- `VITE_FIREBASE_*` - Firebase configuration
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key
- `VITE_GA_MEASUREMENT_ID` - Google Analytics ID
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (live)

## Security Checklist

Before going live, verify:

- [ ] All API keys are production keys (not test keys)
- [ ] Service account JSON is not committed to git
- [ ] `.env` files with secrets are not committed to git
- [ ] CORS is configured correctly (not using `*`)
- [ ] Firestore security rules are deployed
- [ ] Stripe webhook signature verification is enabled
- [ ] HTTPS is enforced (automatic with Cloud Run/Firebase)
- [ ] Authentication is working correctly
- [ ] Only necessary Cloud Run endpoints allow unauthenticated access

## Cost Estimation

Expected monthly costs for production:

| Service | Estimated Cost |
|---------|----------------|
| Cloud Run (Backend) | $10-50/month |
| Firestore (Database) | $5-20/month |
| Firebase Hosting | Free |
| Cloud Storage | $1-5/month |
| Cloud Logging | Free (within limits) |
| **Total** | **~$20-80/month** |

Actual costs depend on:
- Number of active users
- API request volume
- Firestore read/write operations
- Cloud Run compute time
- Storage usage

Monitor costs in [GCP Billing Console](https://console.cloud.google.com/billing)

## Maintenance Tasks

### Regular Updates

Deploy updates using:
```bash
./scripts/deploy-prod.sh
```

### Update Environment Variables

Update environment variables using:
```bash
gcloud run services update backend \
  --region us-central1 \
  --project collegebot-dev-52f43 \
  --update-env-vars "KEY=value,..."
```

### Monitor Service Health

Check daily:
- Cloud Run logs for errors
- Firestore usage and costs
- Stripe webhook delivery
- User authentication success rate

### Backup Strategy

**Firestore Data**:
```bash
# Export Firestore to Cloud Storage
gcloud firestore export gs://collegebot-dev-52f43-backups/$(date +%Y%m%d) \
  --project collegebot-dev-52f43
```

Consider setting up automated daily backups.

## Important Notes

### Single Environment Implications

Since you're using the existing `collegebot-dev-52f43` project:

✅ **Advantages**:
- Simpler setup - no new project needed
- Lower costs - only one environment running
- Shared data between dev and prod domains

⚠️ **Considerations**:
- Production and development share the same database
- Changes affect both environments
- Testing Stripe requires local development or test data in production DB
- No isolation between environments

**Recommendation**: Be careful when testing new features. Consider creating test data with identifiable prefixes (e.g., `test_`) to avoid confusion with production data.

### Stripe Configuration

The backend is configured with production Stripe keys, which means:
- Real credit cards will be charged
- Test cards (4242 4242 4242 4242) will NOT work
- Subscriptions will create real customers in Stripe
- Failed payments will trigger real webhook events

For Stripe testing:
- Use local development environment
- Create test subscriptions with your own credit card
- Immediately cancel test subscriptions in Stripe Dashboard

### Domain Access

Once configured, your application will be accessible at:
- `https://counseled.app` - Production custom domain (primary)
- `https://collegebot-dev-52f43.web.app` - Firebase default domain (also works)
- `https://collegebot-dev-52f43.firebaseapp.com` - Firebase alternate domain (also works)

All three URLs serve the same application and use the same backend/database.

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Custom Domain Setup](https://firebase.google.com/docs/hosting/custom-domain)

## Quick Reference

### Useful Commands

```bash
# Deploy everything
./scripts/deploy-prod.sh

# Update environment variables
./scripts/update-backend-env-prod.sh

# Rollback deployment
./scripts/rollback-prod.sh

# View logs
gcloud run logs read backend --region us-central1 --project collegebot-dev-52f43

# Check service status
gcloud run services describe backend --region us-central1 --project collegebot-dev-52f43
```

### Important URLs

- **Production Site**: https://counseled.app
- **Backend API**: https://backend-75043580028.us-central1.run.app
- **Firebase Console**: https://console.firebase.google.com/project/collegebot-dev-52f43
- **GCP Console**: https://console.cloud.google.com/run?project=collegebot-dev-52f43
- **Stripe Dashboard**: https://dashboard.stripe.com/

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check Cloud Run logs for specific error messages
2. Review Firebase Console for configuration issues
3. Verify all environment variables are set correctly
4. Test in local development environment first
5. Refer to the [two-environment deployment plan](PRODUCTION_DEPLOYMENT_PLAN_TWO_ENVIRONMENTS.md) for a more isolated setup

Good luck with your production deployment! 🚀
