/**
 * MCP tools for family college trackers, scoped to the OAuth token's email.
 * State contract: skills/college-money-finder/references/tracker-artifact.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, trackersForEmail, trackerForEmail, isAdmin } from "./firestore.js";
import { randomBytes } from "node:crypto";
import { getEntitlement, setEntitlement, writesAllowed } from "./entitlements.js";
import { searchColleges, findCollege, playbook, collegeDataLoaded } from "./college-data.js";
import { validatePageHtml, newPageId, pagesForTracker, MAX_PAGES_PER_TRACKER } from "./pages.js";

const MAX_FAMILY_MEMBERS = 6;

const REQUIRED_STATE_KEYS = ["student", "budget", "schools", "todos", "log", "updated"] as const;

const STARTER_STATE = (studentName: string, gradYear: number | null, today: string) => ({
  baseline_version: 1,
  student: { name: studentName, grad_year: gradYear, gpa: null, sat: null, act: null },
  budget: { yearly: null, notes: "" },
  updated: today,
  schools: [],
  todos: [
    { id: "t1", text: "Run the college-money-finder interview with Claude to build the first list", done: false, school: "", due: "" },
  ],
  log: [{ date: today, entry: `Tracker created for ${studentName}.` }],
});

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const err = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

const INSTRUCTIONS = `Counseled helps families find colleges that are financially realistic — especially schools that give substantial merit aid to families who won't qualify for need-based aid. You are connected to this family's Counseled account.

When the user first engages (or asks what you can do), briefly announce your capabilities in plain language:
1. Money-fit analysis: classify 310 U.S. colleges into money tiers for their budget and stats (search_colleges), grounded in official Common Data Set filings — call get_playbook FIRST to load the methodology.
2. School lookups: the money data on any school in the dataset (get_college).
3. The family tracker: read and update their live shared page at counseled.app/tracker (list_trackers, get_tracker, update_tracker) — every change you make is journaled with provenance and appears instantly for the whole family.
4. New families: create a tracker (create_tracker) using their subscription or an invite code.
5. Freeform pages: when the family wants a visualization or tracking view the main tracker doesn't offer, BUILD IT — design a custom page (create_page / update_page) and it appears in their tracker's "Custom pages" section. Pages are body-content-only HTML with everything inlined (external network is blocked by CSP; no iframes/objects). At view time the page receives the live tracker state read-only: call Counseled.ready(state => { ...render... }) and Counseled.onUpdate(state => { ...re-render... }). Offer this proactively when a family's question suggests a bespoke view (comparison matrices, decision grids, timelines, cost projections, essay boards).

Ground rules: read get_playbook before giving college-money advice. Read get_tracker before writing. Never delete schools (archive via status "dropped") and never remove journal entries. Access management is human-only: to add or remove family members, direct the user to the Family button on their tracker page — do not attempt it yourself.`;

export async function buildServer(email: string): Promise<McpServer> {
  const server = new McpServer({ name: "counseled", version: "0.1.0" }, { instructions: INSTRUCTIONS });
  const admin = await isAdmin(email);

  if (admin) {
    server.registerTool(
      "mint_invite",
      {
        title: "Mint invite codes (admin only)",
        description:
          "Admin-only: mint single-use, expiring invite codes that let a new family create a tracker on counseled.app. Returns the codes to hand out.",
        inputSchema: {
          count: z.number().int().min(1).max(20).default(1).describe("How many codes"),
          days: z.number().int().min(1).max(365).default(30).describe("Days until each code expires"),
          note: z.string().default("").describe("Who/what these are for (stored on the code)"),
        },
      },
      async ({ count, days, note }) => {
        const today = new Date().toISOString().slice(0, 10);
        const codes: string[] = [];
        const batch = db.batch();
        for (let i = 0; i < count; i++) {
          const code = "counseled-" + randomBytes(2).toString("hex") + "-" + randomBytes(2).toString("hex");
          batch.set(db.collection("invite_codes").doc(code), {
            created: today, expires: Date.now() + days * 86400_000, note, used_by: null, minted_by: email,
          });
          codes.push(code);
        }
        await batch.commit();
        return text(`Minted ${count} invite code(s), valid ${days} days:\n` + codes.join("\n") +
          `\n\nSend with: https://counseled.app/join (they add the connector, then tell their Claude the code).`);
      }
    );
  }

  server.registerTool(
    "list_trackers",
    {
      title: "List family trackers",
      description:
        "List the college trackers this user's family can access on counseled.app, with student name and last-updated date. Call this first if you don't know the tracker id.",
      inputSchema: {},
    },
    async () => {
      const trackers = await trackersForEmail(email);
      if (!trackers.length) return text(`No trackers found for ${email}.`);
      return text(JSON.stringify(trackers.map((t) => ({
        tracker_id: t.id,
        student: t.state?.student?.name,
        updated: t.state?.updated,
        schools: t.state?.schools?.length ?? 0,
        page: `https://counseled.app/tracker/?t=${t.id}`,
      })), null, 1));
    }
  );

  server.registerTool(
    "get_tracker",
    {
      title: "Read a family tracker",
      description:
        "Read the full current state of a family college tracker (student profile snapshot, budget, school list with money tiers, to-dos, journal). Always read before writing — the family edits this live.",
      inputSchema: { tracker_id: z.string().describe("Tracker id from list_trackers, e.g. 'julia'") },
    },
    async ({ tracker_id }) => {
      const t = await trackerForEmail(email, tracker_id);
      if (!t) return err(`No tracker '${tracker_id}' accessible to ${email}.`);
      return text(JSON.stringify(t.state, null, 1));
    }
  );

  server.registerTool(
    "update_tracker",
    {
      title: "Update a family tracker",
      description:
        "Write the full updated state of a family college tracker. Read with get_tracker first and MERGE: family edits win for statuses, tiers, ordering, notes, to-dos, journal, and archived schools; your analysis wins for money fields (coa, merit_rate, avg_merit, est_price). Never delete schools (archive = status 'dropped'); never remove journal entries. Pass session_note describing what you changed — it is appended to the family's journal as provenance.",
      inputSchema: {
        tracker_id: z.string(),
        state: z.record(z.string(), z.unknown()).describe("The complete state object (same shape get_tracker returns)"),
        session_note: z.string().describe("One sentence describing this update, e.g. 'Re-tiered after October SAT (1510)'"),
      },
    },
    async ({ tracker_id, state, session_note }) => {
      const t = await trackerForEmail(email, tracker_id);
      if (!t) return err(`No tracker '${tracker_id}' accessible to ${email}.`);
      const w = await writesAllowed(t as any);
      if (!w.ok) return err(w.why!);

      for (const key of REQUIRED_STATE_KEYS) {
        if (!(key in state)) return err(`state is missing required key '${key}' — send the COMPLETE state object.`);
      }
      const prev = t.state;
      const next = state as any;
      if ((next.schools?.length ?? 0) < (prev.schools?.length ?? 0)) {
        return err(
          `Refusing: new state has ${next.schools.length} schools but the tracker has ${prev.schools.length}. ` +
          `Schools must never be deleted — archive with status 'dropped'. Re-read with get_tracker and merge.`
        );
      }
      if ((next.log?.length ?? 0) < (prev.log?.length ?? 0)) {
        return err("Refusing: new state has fewer journal entries than the tracker. Journal is append-only.");
      }

      const today = new Date().toISOString().slice(0, 10);
      next.log.push({ date: today, entry: `${session_note} (Claude, via ${email})` });
      next.updated = today;
      next.baseline_version = (prev.baseline_version ?? 0) + 1;

      await t.ref.set({ state: next }, { merge: true });
      return text(
        `Updated tracker '${tracker_id}' to version ${next.baseline_version} ` +
        `(${next.schools.length} schools, ${next.todos.length} todos). ` +
        `Open tabs at https://counseled.app/tracker/?t=${tracker_id} update live.`
      );
    }
  );

  server.registerTool(
    "create_tracker",
    {
      title: "Create a family tracker",
      description:
        "Create a new college tracker for this family on counseled.app. Use when the user has no tracker yet (list_trackers is empty). Works if the user has an active counseled.app subscription (from counseled.app/join) OR provides an invite code. The signed-in user becomes the tracker's owner; family members are added by hand in the tracker page's Family section (Edit mode) — there is intentionally no tool for that.",
      inputSchema: {
        student_name: z.string().describe("The student's name, e.g. 'Alex Rivera'"),
        grad_year: z.number().int().nullable().describe("Expected high-school graduation year, or null if unknown"),
        invite_code: z.string().optional().describe("Invite code, only needed if the family has no subscription"),
      },
    },
    async ({ student_name, grad_year, invite_code }) => {
      const today = new Date().toISOString().slice(0, 10);
      const makeId = () => {
        const base = student_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "family";
        return `${base}-${Math.random().toString(36).slice(2, 8)}`;
      };
      const newTracker = (id: string, source: string) => ({
        allowed_emails: [email],
        owner_email: email,
        created: today,
        source,
        state: STARTER_STATE(student_name, grad_year, today),
      });

      // Path 1: active entitlement (Stripe subscriber or prior invite)
      const ent = await getEntitlement(email);
      if (ent?.status === "active") {
        const id = makeId();
        await db.collection("trackers").doc(id).set(newTracker(id, "entitlement"));
        return created(id, student_name);
      }
      if (ent?.status === "lapsed") {
        return err(`The subscription for ${email} has lapsed. Renew at https://counseled.app/join, or use a new invite code.`);
      }

      // Path 2: invite code (claimed atomically; also grants an entitlement)
      if (!invite_code) {
        return err(
          `${email} has no active counseled.app subscription. Either subscribe at https://counseled.app/join ` +
          `(then retry without a code), or provide an invite code.`
        );
      }
      const codeRef = db.collection("invite_codes").doc(invite_code.trim().toLowerCase());
      let trackerId = "";
      try {
        trackerId = await db.runTransaction(async (tx) => {
          const codeDoc = await tx.get(codeRef);
          if (!codeDoc.exists) throw new Error("invalid invite code");
          const code = codeDoc.data()!;
          if (code.used_by) throw new Error("invite code already used");
          if (code.expires && code.expires < Date.now()) throw new Error("invite code expired");
          const id = makeId();
          tx.set(db.collection("trackers").doc(id), newTracker(id, "invite"));
          tx.update(codeRef, { used_by: email, used_at: today, tracker_id: id });
          return id;
        });
      } catch (e: any) {
        return err(`Could not create tracker: ${e.message}`);
      }
      await setEntitlement(email, { status: "active", source: "invite" });
      return created(trackerId, student_name);
    }
  );

  server.registerTool(
    "create_page",
    {
      title: "Create a custom page for the family",
      description:
        "Build a freeform visualization or tracking view as a custom page in the family's tracker (appears under 'Custom pages'). html is BODY CONTENT ONLY (no doctype/html shell) with ALL CSS/JS inlined — the page runs in a strict sandbox: no external network, no iframes/objects/forms-out, max 400KB. It receives the live tracker state READ-ONLY via Counseled.ready(state => {...}) and Counseled.onUpdate(state => {...}) — always use these rather than hardcoding data, so the page stays current as the tracker changes. Design well: match the tracker's calm aesthetic (system fonts, #1e5b4f accent, #f6f7f5 ground) unless asked otherwise.",
      inputSchema: {
        tracker_id: z.string(),
        title: z.string().max(80).describe("Short human title, e.g. 'Cost vs. selectivity matrix'"),
        html: z.string().describe("Body-content HTML with inline <style>/<script>"),
      },
    },
    async ({ tracker_id, title, html }) => {
      const t = await trackerForEmail(email, tracker_id);
      if (!t) return err(`No tracker '${tracker_id}' accessible to ${email}.`);
      const w = await writesAllowed(t as any);
      if (!w.ok) return err(w.why!);
      const bad = validatePageHtml(html);
      if (bad) return err(bad);
      const existing = await pagesForTracker(tracker_id);
      if (existing.length >= MAX_PAGES_PER_TRACKER) return err(`Tracker already has ${MAX_PAGES_PER_TRACKER} pages — delete or update one instead.`);
      const pageId = newPageId();
      const today = new Date().toISOString().slice(0, 10);
      await db.collection("pages").doc(pageId).set({
        tracker_id, title, html, created_by: email, version: 1, created: today, updated: today,
      });
      const state = t.state;
      state.log.push({ date: today, entry: `Created custom page '${title}' (Claude, via ${email})` });
      await t.ref.set({ state }, { merge: true });
      return text(
        `Created page '${title}' (page_id ${pageId}, v1). The family sees it in the Custom pages section of ` +
        `https://counseled.app/tracker/?t=${tracker_id} — or directly at https://counseled.app/tracker/?t=${tracker_id}&p=${pageId}. ` +
        `It renders with live tracker state; use update_page to iterate.`
      );
    }
  );

  server.registerTool(
    "update_page",
    {
      title: "Update a custom page",
      description:
        "Replace a custom page's html (and optionally title). Same sandbox rules as create_page. Use get_page first to read the current version when iterating on feedback.",
      inputSchema: {
        page_id: z.string(),
        html: z.string(),
        title: z.string().max(80).optional(),
        session_note: z.string().describe("One sentence on what changed, for the family journal"),
      },
    },
    async ({ page_id, html, title, session_note }) => {
      const doc = await db.collection("pages").doc(page_id).get();
      if (!doc.exists) return err(`No page '${page_id}'.`);
      const page = doc.data()!;
      const t = await trackerForEmail(email, page.tracker_id);
      if (!t) return err(`Page '${page_id}' belongs to a tracker not accessible to ${email}.`);
      const w = await writesAllowed(t as any);
      if (!w.ok) return err(w.why!);
      const bad = validatePageHtml(html);
      if (bad) return err(bad);
      const today = new Date().toISOString().slice(0, 10);
      await doc.ref.update({ html, ...(title ? { title } : {}), version: (page.version ?? 1) + 1, updated: today });
      const state = t.state;
      state.log.push({ date: today, entry: `${session_note} — page '${title || page.title}' v${(page.version ?? 1) + 1} (Claude, via ${email})` });
      await t.ref.set({ state }, { merge: true });
      return text(`Updated page '${title || page.title}' to v${(page.version ?? 1) + 1}. Open tabs pick it up on next view.`);
    }
  );

  server.registerTool(
    "list_pages",
    {
      title: "List the family's custom pages",
      description: "List custom pages on a tracker (id, title, version, dates). Use get_page to read one's html.",
      inputSchema: { tracker_id: z.string() },
    },
    async ({ tracker_id }) => {
      const t = await trackerForEmail(email, tracker_id);
      if (!t) return err(`No tracker '${tracker_id}' accessible to ${email}.`);
      const pages = await pagesForTracker(tracker_id);
      return text(pages.length ? JSON.stringify(pages, null, 1) : "No custom pages yet — offer to build one with create_page.");
    }
  );

  server.registerTool(
    "get_page",
    {
      title: "Read a custom page's html",
      description: "Fetch a custom page (metadata + html) so you can iterate on it with update_page.",
      inputSchema: { page_id: z.string() },
    },
    async ({ page_id }) => {
      const doc = await db.collection("pages").doc(page_id).get();
      if (!doc.exists) return err(`No page '${page_id}'.`);
      const page = doc.data()!;
      const t = await trackerForEmail(email, page.tracker_id);
      if (!t) return err(`Page '${page_id}' belongs to a tracker not accessible to ${email}.`);
      return text(JSON.stringify(page, null, 1));
    }
  );

  // NOTE: there is deliberately NO tool for managing tracker access.
  // Access grants are human-only: the Family section of the tracker page
  // (edit mode) is where members add/remove emails by hand. AI assistants
  // refuse to modify access controls — don't add such a tool back.

  if (collegeDataLoaded()) {
    server.registerTool(
      "get_playbook",
      {
        title: "Get the Counseled money-fit playbook",
        description:
          "Read Counseled's college financial-fit methodology BEFORE running an analysis or interviewing a family: money-tier definitions (locks / conditional targets / merit lotteries), how to interview a family about budget (budget ≠ financial need), how to place a student in a school's stats distribution, honest-uncertainty rules, and data caveats. Call once per conversation before using search_colleges.",
        inputSchema: {},
      },
      async () => text(playbook())
    );

    server.registerTool(
      "search_colleges",
      {
        title: "Search colleges by budget and stats",
        description:
          "Run the Counseled money-tier analysis over 310 U.S. colleges (data from official Common Data Set filings + IPEDS). Given a family's yearly budget and the student's stats, returns every school classified as lock / conditional_target / merit_lottery / full_pay_or_bust / over_budget, with sticker cost, merit rate to no-need freshmen, average award, and estimated price after typical merit. Read get_playbook first; curate the output (8-15 schools by fit) rather than dumping it.",
        inputSchema: {
          budget: z.number().describe("Yearly all-in budget in dollars, e.g. 40000"),
          sat: z.number().nullable().optional().describe("SAT composite, if taken"),
          act: z.number().nullable().optional().describe("ACT composite, if taken"),
          gpa: z.number().nullable().optional().describe("Unweighted GPA (4.0 scale)"),
          home_state: z.string().nullable().optional().describe("Two-letter home state for in-state pricing, e.g. 'NJ'"),
        },
      },
      async ({ budget, sat, act, gpa, home_state }) => {
        const r = searchColleges({ budget, sat, act, gpa, home_state });
        const summary = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.length]));
        return text(JSON.stringify({ summary, ...r }, null, 1));
      }
    );

    server.registerTool(
      "get_college",
      {
        title: "Look up one college's money data",
        description:
          "Look up a single college's row in the Counseled dataset: costs, merit-aid rates to no-need freshmen, need-met percentages, admissions stats, data confidence and caveats. Fuzzy name matching.",
        inputSchema: { name: z.string().describe("College name, e.g. 'Tulane' or 'University of Pittsburgh'") },
      },
      async ({ name }) => {
        const row = findCollege(name);
        if (!row) return err(`No college matching '${name}' in the dataset (310 schools). It may still exist — just not in our CDS corpus.`);
        return text(JSON.stringify(row, null, 1));
      }
    );
  }

  function created(id: string, studentName: string) {
    return text(
      `Created tracker '${id}' for ${studentName}. ` +
      `The family page is https://counseled.app/tracker/?t=${id} (sign in with ${email}). ` +
      `To add family members, open that page → Edit → Family access (a by-hand control; there is no tool for it). ` +
      `Next: run the college-money-finder interview and fill the list with update_tracker.`
    );
  }

  return server;
}
