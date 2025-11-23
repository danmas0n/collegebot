# API Key Security Guide

## Overview

This document explains how API keys are used in this project and how to keep them secure.

## Frontend API Keys (Public Keys)

### Keys That MUST Be Public

The following keys are **intentionally** in `frontend/.env.production` and committed to git:
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_GA_MEASUREMENT_ID` - Google Analytics ID
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

**Why are these public?**
- Frontend environment variables are compiled into JavaScript that runs in the browser
- Anyone can view browser JavaScript using DevTools
- There is NO WAY to hide these keys from end users
- This is the expected security model for frontend applications

### How to Secure Public Keys

Since these keys will be public, you MUST restrict them:

#### 1. Add HTTP Referrer Restrictions

Go to [Google Cloud Console → API Credentials](https://console.cloud.google.com/apis/credentials):

1. Find each API key
2. Click "Edit"
3. Under "Application restrictions", select "HTTP referrers (web sites)"
4. Add your domains:
   ```
   https://counseled.app/*
   https://collegebot-dev-52f43.web.app/*
   https://collegebot-dev-52f43.firebaseapp.com/*
   http://localhost:3000/*
   ```
5. Under "API restrictions", select "Restrict key"
6. Enable only the APIs you need:
   - Google Maps JavaScript API
   - Gemini API
   - (any others you use)

#### 2. Monitor Usage

Regularly check Google Cloud Console for unexpected API usage:
- Set up billing alerts
- Review API usage dashboards
- Enable quota limits

#### 3. Rotate Keys If Compromised

If a key is compromised (used maliciously):
1. Go to Google Cloud Console → API Credentials
2. Find the key and click "Edit"
3. Click "Regenerate Key" or "Rotate Key"
4. Update `frontend/.env` and `frontend/.env.production` with new key
5. Commit and deploy

## Backend API Keys (Secret Keys)

### Keys That MUST Remain Secret

The following keys should NEVER be committed to git:
- `CLAUDE_API_KEY` - Claude API secret key
- `STRIPE_SECRET_KEY` - Stripe secret key (sk_live_... or sk_test_...)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- Service account JSON files

**Where should these be stored?**
- Locally: In `backend/.env` (gitignored)
- Production: As Cloud Run environment variables
- Never: In git history or public repositories

### How to Secure Secret Keys

1. **Use `.gitignore`**: Ensure `backend/.env` is gitignored
2. **Use Cloud Run env vars**: Set secrets as environment variables in Cloud Run
3. **Rotate regularly**: Change keys periodically and after any suspected compromise
4. **Monitor usage**: Check Stripe Dashboard and Claude API usage for anomalies

## What To Do If Keys Are Exposed

### If Frontend Keys Are Exposed
1. **Don't panic** - They're meant to be public
2. **Check restrictions** - Ensure HTTP referrer restrictions are in place
3. **Review usage** - Check for unexpected API calls
4. **Rotate if needed** - If usage is abnormal, rotate the keys

### If Backend Keys Are Exposed
1. **Rotate immediately** - Generate new keys in respective dashboards
2. **Remove from git history** - Use `git filter-branch` or BFG Repo Cleaner
3. **Update deployments** - Deploy with new keys ASAP
4. **Review billing** - Check for fraudulent usage
5. **Enable alerts** - Set up billing and usage alerts

## Key Rotation Checklist

When rotating API keys:

- [ ] Generate new key in appropriate console (Google/Stripe/Claude)
- [ ] Add restrictions to new key (HTTP referrers, API limits)
- [ ] Update local `.env` files
- [ ] Update production environment variables (Cloud Run)
- [ ] Deploy updated application
- [ ] Test that application works with new keys
- [ ] Delete old key after confirming new key works
- [ ] Update any documentation referencing the old key

## Best Practices

1. **Never commit secrets to git** - Use `.gitignore` for all `.env` files containing secrets
2. **Use environment-specific keys** - Separate keys for dev/staging/production
3. **Restrict keys appropriately** - HTTP referrers for frontend, no access for backend
4. **Monitor usage** - Set up alerts for unusual activity
5. **Rotate periodically** - Change keys every 90 days or after team changes
6. **Use Secret Manager** (advanced) - Consider Google Cloud Secret Manager for backend secrets
7. **Audit access** - Regularly review who has access to production keys

## Resources

- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Stripe API Key Safety](https://stripe.com/docs/keys)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

## Questions?

If you're unsure whether a key should be public or secret, follow this rule:
- **Frontend (browser)**: Must be public, restrict by HTTP referrer
- **Backend (server)**: Must be secret, use environment variables
