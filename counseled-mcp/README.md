# counseled-mcp

Remote MCP server that lets any family's own Claude (claude.ai custom
connector or Claude Code) read and write their college tracker on
counseled.app. OAuth 2.1 (dynamic client registration + PKCE) with Google
sign-in via the existing Firebase Auth; state in the existing Firestore
(`trackers/{id}` docs, same ones the live tracker page syncs with).

## Tools

| Tool | What it does |
|---|---|
| `list_trackers` | Trackers the signed-in user's email can access |
| `get_tracker` | Full state (student, budget, schools, todos, journal) |
| `update_tracker` | Full-state write with merge guardrails: schools can never be deleted (archive via status `dropped`), journal is append-only, every write appends a provenance entry and bumps `baseline_version` |
| `create_tracker` | Self-serve onboarding: creates a starter tracker for the signed-in user. Requires an active **entitlement** (Stripe subscriber via /join, or a redeemed invite) or a single-use expiring **invite code** (mint with `scripts/mint-invite.py`). Redeeming a code grants an entitlement, so families with multiple kids create more trackers without new codes. |
| `add_family_member` | Any member grants another Google email access to their tracker (max 6) — works for both the web page and that person's own Claude. |
| `get_playbook` | The full money-fit methodology + interview guide + data caveats — makes the connector self-sufficient without the skill installed. |
| `search_colleges` | Server-side money-tier analysis over the bundled 310-school dataset (`data/colleges.csv`, kept in sync by cds-refresh). |
| `get_college` | One school's row, fuzzy name match. |

Access model: any Google account may complete OAuth, but a token can only
(a) touch trackers whose `allowed_emails` contains its email — same rule the
web page enforces — and (b) create a tracker with a valid invite code.
Tokens without either capability can do nothing.

## Local test

```bash
firebase emulators:start --only firestore,auth --project demo-counseled &
npm run build
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
  GOOGLE_CLOUD_PROJECT=demo-counseled PUBLIC_URL=http://localhost:8787 PORT=8787 \
  node build/index.js &
python3 test/e2e.py   # 14 checks: OAuth flow, MCP handshake, tools, guardrails, scoping
```

## Deploy (Cloud Run)

```bash
cd counseled-mcp
gcloud run deploy counseled-mcp --source . \
  --project collegebot-dev-52f43 --region us-central1 \
  --allow-unauthenticated --min-instances 0
# note the service URL it prints, then bake it in:
gcloud run services update counseled-mcp --project collegebot-dev-52f43 \
  --region us-central1 --set-env-vars PUBLIC_URL=<service URL>
```

`--allow-unauthenticated` is correct: OAuth happens at the application layer;
the Cloud Run default service account provides Firestore access via ADC.
Optional: map `mcp.counseled.app` to the service and set PUBLIC_URL to that
instead (do this before real users connect — the URL is baked into tokens'
issuer metadata).

## Connect a Claude

- **claude.ai:** Settings → Connectors → Add custom connector → `<PUBLIC_URL>/mcp`
  → sign in with the Google account that's on your family's tracker.
- **Claude Code:** `claude mcp add --transport http counseled <PUBLIC_URL>/mcp`

## Billing (Stripe, optional)

Without Stripe env vars the service runs **invite-only** (`/join` says so).
To enable subscriptions ($39/yr family plan):

1. Stripe dashboard → create a Product ("Counseled family plan") with a
   yearly Price; copy the `price_...` id.
2. Dashboard → Developers → Webhooks → Add endpoint:
   `<PUBLIC_URL>/stripe/webhook`, events `customer.subscription.updated` +
   `customer.subscription.deleted`; copy the `whsec_...` secret.
3. Set env vars on the Cloud Run service:
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.

Flow: `/join` → Checkout → `/join/success` writes an active entitlement for
the checkout email → that user's Claude runs `create_tracker` with no code.
Cancellation/lapse ⇒ entitlement `lapsed` ⇒ the family's trackers become
**read-only** (data always readable/exportable; renewal re-enables writes).
`counseled.app/join` is proxied to this service via a Firebase Hosting
rewrite, so printed URLs can use the friendly domain.

## Notes

- OAuth artifacts live in Firestore collections `oauth_clients`,
  `oauth_requests`, `oauth_codes`, `oauth_tokens` (opaque revocable tokens:
  access 1h, refresh 30d). To revoke a user, delete their token docs.
- Expired docs are small and harmless; add a TTL policy on `expires` fields
  in the Firestore console when convenient.
- The Firestore *rules* don't apply to this server (admin SDK) — scoping is
  enforced in `src/firestore.ts` (`trackersForEmail`). Keep it that way.
