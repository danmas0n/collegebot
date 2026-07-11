/**
 * OAuth 2.1 provider for the counseled.app MCP connector.
 *
 * Flow: claude.ai (or Claude Code) dynamically registers as a client, sends
 * the user to /authorize (handled by the SDK router, which calls
 * provider.authorize) -> we park the request in oauth_requests and render a
 * Google sign-in page -> the page POSTs the Firebase ID token to
 * /oauth/consent -> we verify it, require the email to have tracker access,
 * mint a PKCE-bound code, and redirect back to the client -> the SDK router's
 * /token endpoint calls exchangeAuthorizationCode.
 *
 * Tokens are opaque random strings stored in Firestore (revocable, no JWT
 * key management). Access tokens 1h, refresh tokens 30d, codes 10min.
 */
import { randomBytes } from "node:crypto";
import type { Response, Request } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { db, auth } from "./firestore.js";

const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TTL_MS = 15 * 60 * 1000;

// Public Firebase web config (same one the counseled.app frontend ships).
const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyAP5Y9GFIGjapG-wjzA8in-YFBuBFLorVk",
  authDomain: "collegebot-dev-52f43.firebaseapp.com",
  projectId: "collegebot-dev-52f43",
};

const token = (prefix: string) => prefix + "_" + randomBytes(32).toString("base64url");

export const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId: string) {
    const doc = await db.collection("oauth_clients").doc(clientId).get();
    return doc.exists ? (doc.data() as OAuthClientInformationFull) : undefined;
  },
  async registerClient(client) {
    try {
      const full: OAuthClientInformationFull = {
        ...client,
        client_id: token("client"),
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };
      // strip undefined values (public clients have no client_secret) —
      // Firestore rejects undefined
      await db.collection("oauth_clients").doc(full.client_id).set(JSON.parse(JSON.stringify(full)));
      return full;
    } catch (e) {
      console.error("registerClient failed:", e);
      throw e;
    }
  },
};

export const provider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client, params: AuthorizationParams, res: Response) {
    const reqId = token("authreq");
    await db.collection("oauth_requests").doc(reqId).set({
      clientId: client.client_id,
      clientName: client.client_name || "your Claude",
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      state: params.state ?? null,
      scopes: params.scopes ?? [],
      expires: Date.now() + REQUEST_TTL_MS,
    });
    res.type("html").send(loginPage(reqId, client.client_name || "your Claude"));
  },

  async challengeForAuthorizationCode(_client, code) {
    const doc = await db.collection("oauth_codes").doc(code).get();
    if (!doc.exists) throw new Error("invalid authorization code");
    return doc.data()!.codeChallenge as string;
  },

  async exchangeAuthorizationCode(client, code) {
    const ref = db.collection("oauth_codes").doc(code);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("invalid authorization code");
    const data = doc.data()!;
    await ref.delete(); // single use
    if (data.clientId !== client.client_id) throw new Error("code issued to a different client");
    if (data.expires < Date.now()) throw new Error("authorization code expired");
    return issueTokens(client.client_id, data.email as string, data.scopes ?? []);
  },

  async exchangeRefreshToken(client, refreshToken, scopes) {
    const ref = db.collection("oauth_tokens").doc(refreshToken);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("invalid refresh token");
    const data = doc.data()!;
    if (data.type !== "refresh" || data.clientId !== client.client_id) throw new Error("invalid refresh token");
    if (data.expires < Date.now()) {
      await ref.delete();
      throw new Error("refresh token expired");
    }
    return issueTokens(client.client_id, data.email as string, scopes ?? data.scopes ?? []);
  },

  async verifyAccessToken(t: string): Promise<AuthInfo> {
    const doc = await db.collection("oauth_tokens").doc(t).get();
    if (!doc.exists) throw new Error("invalid token");
    const data = doc.data()!;
    if (data.type !== "access" || data.expires < Date.now()) throw new Error("token expired");
    return {
      token: t,
      clientId: data.clientId,
      scopes: data.scopes ?? [],
      expiresAt: Math.floor(data.expires / 1000),
      extra: { email: data.email },
    };
  },

  async revokeToken(_client, { token: t }) {
    await db.collection("oauth_tokens").doc(t).delete().catch(() => {});
  },
};

async function issueTokens(clientId: string, email: string, scopes: string[]): Promise<OAuthTokens> {
  const access = token("at");
  const refresh = token("rt");
  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection("oauth_tokens").doc(access), {
    type: "access", clientId, email, scopes, expires: now + ACCESS_TTL_MS, created: now,
  });
  batch.set(db.collection("oauth_tokens").doc(refresh), {
    type: "refresh", clientId, email, scopes, expires: now + REFRESH_TTL_MS, created: now,
  });
  await batch.commit();
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

/** POST /oauth/consent  { reqId, idToken } — called by the sign-in page. */
export async function handleConsent(req: Request, res: Response) {
  try {
    const { reqId, idToken } = req.body ?? {};
    if (!reqId || !idToken) return res.status(400).json({ error: "missing reqId or idToken" });

    const reqRef = db.collection("oauth_requests").doc(String(reqId));
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(400).json({ error: "unknown or expired authorization request" });
    const pending = reqDoc.data()!;
    if (pending.expires < Date.now()) {
      await reqRef.delete();
      return res.status(400).json({ error: "authorization request expired — retry from Claude" });
    }

    const decoded = await auth.verifyIdToken(String(idToken));
    const email = decoded.email;
    if (!email) return res.status(403).json({ error: "Google account has no email" });

    // Users with no tracker yet may still authorize: their token can only
    // list (empty) and create_tracker with a valid invite code. Actual
    // tracker access is enforced per-tool by allowed_emails.

    const code = token("code");
    await db.collection("oauth_codes").doc(code).set({
      clientId: pending.clientId,
      codeChallenge: pending.codeChallenge,
      email,
      scopes: pending.scopes,
      expires: Date.now() + CODE_TTL_MS,
    });
    await reqRef.delete();

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("code", code);
    if (pending.state) redirect.searchParams.set("state", pending.state);
    return res.json({ redirect: redirect.toString() });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "consent failed" });
  }
}

function loginPage(reqId: string, clientName: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Counseled</title>
<style>
  body { font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif; background: #f6f7f5; color: #22302c;
         display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border: 1px solid #e2e6e3; border-radius: 8px; padding: 32px; max-width: 400px; text-align: center; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-size: 1.3rem; margin: 0 0 8px; }
  p { color: #66756e; font-size: .9rem; }
  button { font: inherit; padding: 10px 18px; border-radius: 6px; border: none; background: #1e5b4f; color: #fff; cursor: pointer; }
  .err { color: #b54a35; font-size: .85rem; min-height: 1.2em; }
</style></head><body>
<div class="card">
  <h1>Connect Counseled to ${clientName.replace(/[<>&"]/g, "")}</h1>
  <p>Sign in with the Google account your family uses on counseled.app. Your Claude will be able to read and update your family's college tracker.</p>
  <button id="go">Sign in with Google</button>
  <p class="err" id="err"></p>
</div>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script>
  firebase.initializeApp(${JSON.stringify(FIREBASE_WEB_CONFIG)});
  document.getElementById("go").onclick = async () => {
    const err = document.getElementById("err");
    err.textContent = "";
    try {
      const cred = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      const r = await fetch("/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reqId: ${JSON.stringify(reqId)}, idToken })
      });
      const body = await r.json();
      if (body.redirect) location.href = body.redirect;
      else err.textContent = body.error || "Something went wrong.";
    } catch (e) { err.textContent = e.message; }
  };
</script>
</body></html>`;
}
