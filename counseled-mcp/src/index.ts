/**
 * counseled-mcp — remote MCP server for counseled.app family trackers.
 *
 * Endpoints:
 *   /.well-known/*  OAuth discovery metadata   (SDK router)
 *   /register       dynamic client registration (SDK router)
 *   /authorize      Google sign-in page         (SDK router -> provider)
 *   /token          code/refresh exchange       (SDK router)
 *   /oauth/consent  sign-in page callback       (ours)
 *   /mcp            MCP Streamable HTTP, bearer-protected
 *   /healthz        liveness
 *
 * Env: PUBLIC_URL (e.g. https://mcp.counseled.app), PORT (Cloud Run sets it),
 *      GOOGLE_CLOUD_PROJECT. Credentials via ADC (Cloud Run service account).
 */
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { provider, handleConsent } from "./oauth.js";
import { buildServer } from "./tools.js";
import { findCollege, collegeCount } from "./college-data.js";
import { mountPages } from "./pages.js";
import { mountBilling, billingEnabled } from "./billing.js";

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();
mountBilling(app); // mounts /stripe/webhook with raw body — must precede express.json
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: new URL(PUBLIC_URL),
    resourceName: "Counseled family college tracker",
    scopesSupported: ["tracker"],
  })
);

app.post("/oauth/consent", handleConsent);
mountPages(app);

// Public read-only college-data API for the tracker page's data panels.
// The dataset is public information (CDS/IPEDS extracts); no auth needed.
const API_ORIGINS = new Set([
  "https://counseled.app",
  "https://collegebot-dev-52f43.web.app",
  "http://localhost:5001",
]);
app.get("/api/college", (req, res) => {
  const origin = String(req.headers.origin || "");
  if (API_ORIGINS.has(origin)) res.set("Access-Control-Allow-Origin", origin);
  const name = String(req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const row = findCollege(name);
  if (!row) return res.status(404).json({ error: `no college matching '${name}' in the ${collegeCount()} -school dataset` });
  res.set("Cache-Control", "public, max-age=86400");
  return res.json(row);
});

const bearer = requireBearerAuth({
  verifier: provider,
  resourceMetadataUrl: new URL("/.well-known/oauth-protected-resource", PUBLIC_URL).toString(),
});

// Stateless mode: one transport+server instance per request, scoped to the
// authenticated user's email. Simple and Cloud-Run-friendly (no session
// affinity needed).
app.post("/mcp", bearer, async (req, res) => {
  const email = (req.auth?.extra as { email?: string } | undefined)?.email;
  if (!email) {
    res.status(403).json({ error: "token has no email" });
    return;
  }
  const server = await buildServer(email);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Stateless servers have nothing to GET/DELETE; reply per spec.
app.get("/mcp", bearer, (_req, res) => res.status(405).set("Allow", "POST").send());
app.delete("/mcp", bearer, (_req, res) => res.status(405).set("Allow", "POST").send());

app.listen(PORT, () => {
  console.log(`counseled-mcp listening on :${PORT} (public: ${PUBLIC_URL}, billing: ${billingEnabled ? "on" : "invite-only"})`);
});
