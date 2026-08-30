/**
 * Read-only share links: counseled.app/s/{token} — for the "college plans
 * aren't secrets" audience (grandparents, counselors) with an optional light
 * passphrase. Write access always stays behind real Google auth.
 *
 * shares/{token} = { tracker_id, label, passphrase_hash|null, created,
 *                    created_by, attempts? }
 * Docs are CREATED AND REVOKED ONLY BY FAMILY MEMBERS BY HAND in the tracker
 * page's Family & sharing dialog (Firestore rules gate it); there is
 * deliberately no MCP tool — creating a share is a sharing-permission change,
 * which AI assistants refuse and the product keeps human-only.
 *
 * passphrase_hash = hex(sha256(token + passphrase)) — computed client-side at
 * creation (SubtleCrypto), verified here. Attempts are counted per token and
 * hard-capped as a brute-force backstop; revoke-and-recreate resets.
 */
import { createHash } from "node:crypto";
import type { Express } from "express";
import { db } from "./firestore.js";

const MAX_ATTEMPTS = 300;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function mountShares(app: Express) {
  app.get("/s/:token", async (req, res) => {
    const doc = await db.collection("shares").doc(String(req.params.token)).get();
    if (!doc.exists) return res.status(404).type("text").send("This share link doesn't exist or was revoked.");
    const share = doc.data()!;
    res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" });
    res.type("html").send(viewerPage(doc.id, Boolean(share.passphrase_hash), String(share.label || "")));
  });

  app.post("/s/:token/state", async (req, res) => {
    const ref = db.collection("shares").doc(String(req.params.token));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "revoked" });
    const share = doc.data()!;
    if (share.passphrase_hash) {
      if ((share.attempts ?? 0) >= MAX_ATTEMPTS)
        return res.status(429).json({ error: "Too many passphrase attempts — ask the family for a fresh link." });
      const pass = String(req.body?.passphrase ?? "");
      if (sha256(doc.id + pass) !== share.passphrase_hash) {
        await ref.update({ attempts: (share.attempts ?? 0) + 1 }).catch(() => {});
        return res.status(403).json({ error: "That passphrase isn't right." });
      }
    }
    const tracker = await db.collection("trackers").doc(share.tracker_id).get();
    if (!tracker.exists) return res.status(404).json({ error: "tracker gone" });
    return res.json({ state: tracker.data()!.state, label: share.label || "" });
  });
}

/** Self-contained read-only viewer. Fetches state via POST (with passphrase
 * when required), renders the family's money brief. No auth, no Firebase. */
function viewerPage(token: string, needsPass: boolean, label: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${label.replace(/[<>&"]/g, "") || "College search"} — shared via Counseled</title>
<style>
  :root { --ink:#22302c; --muted:#66756e; --ground:#f6f7f5; --card:#fff; --line:#e2e6e3;
          --accent:#1e5b4f; --accent-soft:#e4eeeb; --good:#2e7d4f; --warn:#b7791f; --bad:#b54a35;
          --serif:"Iowan Old Style",Palatino,Georgia,serif; --sans:"Avenir Next","Segoe UI",system-ui,sans-serif; }
  body { margin:0; padding:24px 16px 48px; background:var(--ground); color:var(--ink); font-family:var(--sans); }
  .wrap { max-width:720px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }
  h1 { font-family:var(--serif); font-size:1.5rem; font-weight:600; margin:0; }
  .headline { display:flex; flex-wrap:wrap; gap:6px 18px; color:var(--muted); font-size:.88rem; margin-top:6px; }
  .headline strong { color:var(--ink); font-variant-numeric:tabular-nums; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px 18px; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:4px 18px; }
  .tile .label { font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:3px; }
  .tile .value { font-size:1.1rem; font-weight:600; font-variant-numeric:tabular-nums; }
  .tile .sub { font-size:.8rem; color:var(--muted); }
  section h2 { font-family:var(--serif); font-size:1.02rem; font-weight:600; margin:0 0 6px; }
  .row { display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:center; padding:7px 0;
         border-bottom:1px solid var(--ground); font-size:.9rem; }
  .row:last-child { border-bottom:none; }
  .row .name i { font-style:normal; display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:8px; }
  .bar { position:relative; width:110px; height:8px; border-radius:4px; background:var(--accent-soft); }
  .bar b { position:absolute; inset:0 auto 0 0; border-radius:4px; background:var(--accent); }
  .bar b.over { background:var(--bad); }
  .bar i { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--ink); }
  .price { font-variant-numeric:tabular-nums; font-weight:600; min-width:64px; text-align:right; }
  .gate { max-width:380px; margin:14vh auto 0; background:var(--card); border:1px solid var(--line);
          border-radius:8px; padding:26px; text-align:center; }
  .gate input { font:inherit; width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius:6px;
                padding:9px 10px; margin:12px 0; text-align:center; }
  .gate button { font:inherit; padding:9px 18px; border-radius:6px; border:none; background:var(--accent);
                 color:#fff; cursor:pointer; }
  .gate .err { color:var(--bad); font-size:.85rem; min-height:1.2em; }
  footer { color:var(--muted); font-size:.78rem; }
</style></head><body><div class="wrap" id="app"></div>
<script>
(function () {
  var NEEDS_PASS = ${needsPass};
  var app = document.getElementById("app");
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var money = function (n) { return n == null ? "—" : "$" + Math.round(+n).toLocaleString(); };
  var kmoney = function (n) { return n == null ? "—" : "$" + (Math.round(+n / 100) / 10).toFixed(1) + "k"; };
  var TIER = { lock: ["Locks", "var(--good)"], conditional_target: ["Conditional targets", "var(--accent)"],
               merit_lottery: ["Merit lotteries", "var(--warn)"], long_shot: ["Long shots", "var(--bad)"] };

  function gate(err) {
    app.innerHTML = '<div class="gate"><h1 style="font-size:1.2rem">Shared college tracker</h1>' +
      '<p style="color:var(--muted);font-size:.9rem">This link is protected by a passphrase from the family.</p>' +
      '<input id="pp" type="password" placeholder="passphrase" autocomplete="off">' +
      '<div class="err">' + esc(err || "") + '</div><button id="go">Open</button></div>';
    var open = function () { load(document.getElementById("pp").value); };
    document.getElementById("go").onclick = open;
    document.getElementById("pp").addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
  }

  function load(passphrase) {
    fetch(location.pathname + "/state", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: passphrase || "" }) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (r) {
        if (!r.ok) {
          if (r.status === 403 && NEEDS_PASS) return gate(passphrase ? r.body.error : "");
          app.innerHTML = '<div class="gate"><p>' + esc(r.body.error || "This link is no longer available.") + "</p></div>";
          return;
        }
        render(r.body.state);
      })
      .catch(function () { app.innerHTML = '<div class="gate"><p>Could not load — try again in a minute.</p></div>'; });
  }

  function render(state) {
    var active = (state.schools || []).filter(function (s) { return s.status !== "dropped"; });
    var budget = state.budget && state.budget.yearly;
    var est = function (s) { return s.npc_estimate != null ? s.npc_estimate : (s.est_price != null ? s.est_price : s.coa); };
    var maxPrice = Math.max((budget || 1) * 1.4, 1);
    active.forEach(function (s) { maxPrice = Math.max(maxPrice, s.coa || 0); });
    var tiers = Object.keys(TIER).map(function (k) {
      var ss = active.filter(function (s) { return s.tier === k; });
      if (!ss.length) return "";
      return '<section class="card"><h2>' + TIER[k][0] +
        ' <span style="color:var(--muted);font-weight:400;font-size:.85rem">' + ss.length + "</span></h2>" +
        ss.map(function (s) {
          var e = est(s), pct = e ? Math.min(100, e / maxPrice * 100) : 0, bp = Math.min(100, (budget || 0) / maxPrice * 100);
          return '<div class="row"><span class="name"><i style="background:' + TIER[k][1] + '"></i>' + esc(s.name) + "</span>" +
            '<span class="bar"><b class="' + (e > budget ? "over" : "") + '" style="width:' + pct + '%"></b><i style="left:' + bp + '%"></i></span>' +
            '<span class="price">' + kmoney(e) + "</span></div>";
        }).join("") + "</section>";
    }).join("");
    app.innerHTML =
      "<header><h1>" + esc(state.student && state.student.name || "Family") + " — College Search</h1>" +
      '<div class="headline"><span>Class of <strong>' + esc(state.student && state.student.grad_year || "—") + "</strong></span>" +
      "<span>Budget <strong>" + money(budget) + "/yr</strong></span>" +
      "<span>Updated <strong>" + esc(state.updated || "") + "</strong></span></div></header>" +
      tiers +
      "<footer>Shared read-only by the family via Counseled. Estimates from Common Data Set / IPEDS data and " +
      "the family's own research; none are offers. Prices per year; the dark mark on each bar is the family budget.</footer>";
  }

  NEEDS_PASS ? gate("") : load("");
})();
</script></body></html>`;
}
