/**
 * MCP tools for family college trackers, scoped to the OAuth token's email.
 * State contract: skills/college-money-finder/references/tracker-artifact.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { trackersForEmail, trackerForEmail } from "./firestore.js";

const REQUIRED_STATE_KEYS = ["student", "budget", "schools", "todos", "log", "updated"] as const;

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const err = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

export function buildServer(email: string): McpServer {
  const server = new McpServer({ name: "counseled", version: "0.1.0" });

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

  return server;
}
