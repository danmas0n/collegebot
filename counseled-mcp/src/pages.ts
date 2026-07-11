/**
 * Freeform family pages — Claude-authored HTML hosted in a strict sandbox.
 *
 * Storage: pages/{pageId} = { tracker_id, title, html, created_by, version,
 * created, updated }. pageId is an unguessable capability id; the HTML never
 * contains family data — data reaches a page only at view time, through a
 * nonce-verified MessageChannel from the authenticated tracker page.
 *
 * Security model (mirrors claudeusercontent.com in miniature):
 * - served from the MCP origin, never counseled.app (no Firebase session)
 * - viewed inside <iframe sandbox="allow-scripts"> (opaque origin)
 * - CSP: no network of any kind (connect/img/script/style locked to
 *   inline+data:), no frames, no forms, no base-uri
 * - creation-time lint rejects frames/objects/meta-refresh early with a
 *   clear error so Claude can fix its page (CSP would block them anyway)
 * - read-only data in v1: pages receive state, they never write it
 */
import { randomBytes } from "node:crypto";
import type { Express } from "express";
import { db } from "./firestore.js";

export const MAX_PAGE_HTML = 400_000;
export const MAX_PAGES_PER_TRACKER = 20;
const FORBIDDEN = /<\s*(iframe|object|embed|base)\b|http-equiv\s*=\s*["']?\s*refresh|<!doctype|<\s*html\b/i;

export function validatePageHtml(html: string): string | null {
  if (!html.trim()) return "page html is empty";
  if (html.length > MAX_PAGE_HTML)
    return `page too large (${html.length} chars; max ${MAX_PAGE_HTML}). Inline less, or simplify — no external libraries can load anyway.`;
  const m = html.match(FORBIDDEN);
  if (m)
    return `forbidden construct in page: '${m[0].trim()}'. Pages are BODY-CONTENT ONLY (no <!doctype>/<html> shell) and may not use iframe/object/embed/base or meta refresh. Inline all CSS/JS; external network is blocked by CSP.`;
  return null;
}

export const newPageId = () => "pg_" + randomBytes(16).toString("base64url");

export async function pagesForTracker(trackerId: string) {
  const snap = await db.collection("pages").where("tracker_id", "==", trackerId).get();
  return snap.docs.map((d) => {
    const { title, version, created_by, created, updated } = d.data();
    return { page_id: d.id, title, version, created_by, created, updated };
  });
}

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors https://counseled.app https://collegebot-dev-52f43.web.app http://localhost:5001",
].join("; ");

/** Bootstrap injected ahead of the page's own code. Captures the capability
 * nonce from the URL fragment (and immediately clears it) before any page
 * code runs; exposes the tiny read-only API: Counseled.ready(cb),
 * Counseled.onUpdate(cb). Data arrives only over a MessageChannel port that
 * the parent transfers after verifying the nonce. */
const BOOTSTRAP = `<script>
(function () {
  var k = (location.hash.match(/k=([A-Za-z0-9_-]+)/) || [])[1] || null;
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
  var readyCbs = [], updateCbs = [], state = null;
  window.Counseled = {
    ready: function (cb) { state !== null ? cb(state) : readyCbs.push(cb); },
    onUpdate: function (cb) { updateCbs.push(cb); }
  };
  window.addEventListener("message", function once(ev) {
    if (!ev.data || ev.data.type !== "counseled-port" || !ev.ports || !ev.ports[0]) return;
    window.removeEventListener("message", once);
    ev.ports[0].onmessage = function (m) {
      if (!m.data || m.data.type !== "state") return;
      var first = state === null;
      state = m.data.state;
      var cbs = first ? readyCbs : updateCbs;
      for (var i = 0; i < cbs.length; i++) { try { cbs[i](state); } catch (e) {} }
      if (first) readyCbs = [];
    };
  });
  if (window.parent !== window) window.parent.postMessage({ type: "counseled-ready", k: k }, "*");
})();
</script>`;

export function mountPages(app: Express) {
  app.get("/p/:pageId", async (req, res) => {
    const doc = await db.collection("pages").doc(String(req.params.pageId)).get();
    if (!doc.exists) return res.status(404).type("text").send("no such page");
    const { title, html } = doc.data()!;
    res.set({
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=60",
    });
    res.type("html").send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${String(title || "Counseled page").replace(/[<>&"]/g, "")}</title>` +
      BOOTSTRAP + `</head><body>\n${html}\n</body></html>`
    );
  });
}
