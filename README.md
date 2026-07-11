# Counseled

Helps families find colleges that are **financially realistic** — especially
the "hidden fit" schools that award substantial merit aid to families who
won't qualify for need-based aid. Built around one insight: Section H2A of
each college's Common Data Set reports exactly how many freshmen with **no
financial need** received merit scholarships, and how much — the best public
signal of "will a family like ours actually get money here."

**Architecture (July 2026):** users bring their own Claude; Counseled
provides the data, the methodology, and the family's shared state.

```
┌─ family's own Claude (claude.ai or Claude Code) ─────────────┐
│  college-money-finder skill  →  counseled MCP connector      │
└──────────────────────────────┬───────────────────────────────┘
                               │ OAuth 2.1 (Google sign-in)
       counseled-mcp (Cloud Run) ── Firestore ── tracker page
                                  trackers/{id}   counseled.app/tracker/?t=<id>
                                                  (live sync, in-page editing)
```

## What's in this repo

| Path | What it is |
|---|---|
| [`skills/college-money-finder/`](skills/college-money-finder/) | Customer-facing Claude skill: family interview → budget-frontier analysis over the embedded dataset → money tiers (locks / conditional targets / merit lotteries / long shots) → advice letter + live tracker. Install: zip and upload to claude.ai (Settings → Capabilities → Skills) or drop into `~/.claude/skills/`. |
| [`skills/college-money-finder/data/colleges.csv`](skills/college-money-finder/data/colleges.csv) | The dataset: 310 schools × ~30 fields extracted from official CDS filings (H2A merit-to-no-need rates, costs, admissions stats), COA backfilled from IPEDS. Provenance + caveats in [DATA_NOTES.md](skills/college-money-finder/data/DATA_NOTES.md). |
| [`skills/cds-refresh/`](skills/cds-refresh/) | Maintainer skill: annual pipeline to re-source CDS filings, re-extract with parallel subagents, sanity-check, and rebuild the dataset. The exact prompts that produced the current data are in its references. |
| [`counseled-mcp/`](counseled-mcp/) | Remote MCP server (Cloud Run): OAuth 2.1 with dynamic client registration, Google sign-in via Firebase Auth; tools `list_trackers` / `get_tracker` / `update_tracker`, scoped to the signed-in user's email, with merge guardrails (schools never deleted, journal append-only, provenance on every write). Deploy + connect instructions in its [README](counseled-mcp/README.md). |
| [`frontend/public/tracker/`](frontend/public/tracker/) | The family tracker page (`counseled.app/tracker/?t=<id>`): Firestore-backed, Google sign-in, live multi-device sync, in-page editing (add/archive/reorder schools, tiers, statuses, notes, to-dos, journal). |
| [`scripts/seed-tracker.py`](scripts/seed-tracker.py) | Seeds a tracker document (state JSON is gitignored — personal data). |
| `mcp/college-data-server/storage/` | Raw CDS corpus: 1,692 filings, 318 schools, 2017-18 → 2023-24. **Gitignored**; archived at `gs://counseled-cds-archive` (with extraction derivatives). Do not delete either copy without confirming the other. |
| `frontend/` (app), `backend/` | The original CollegeBot web app (wizard UI, chat backend, Stripe billing at $39/mo). **Deprecated** — superseded by the skill + connector architecture above; kept for its billing/auth patterns and the family accounts still on it. See git history for its heyday. |

## Runbooks

- Deploy tracker page + rules: `firebase deploy --only firestore:rules,hosting`
- Deploy MCP server: see [counseled-mcp/README.md](counseled-mcp/README.md)
  (note: the Cloud Run host must be added to the Firebase API key's referrer
  list AND Firebase Auth authorized domains, or Google sign-in is blocked)
- Refresh the dataset (annual, ~June): run the `cds-refresh` skill in Claude Code
- Add a family member to a tracker:
  `python3 skills/college-money-finder/scripts/sync_tracker.py allow <id> --email <email>`
- Invite a new family (they create their own tracker via their Claude):
  `python3 scripts/mint-invite.py --note "for the Smiths"` → send them the
  code + the skill zip + the connector URL

## License

Apache License 2.0 with Commons Clause — see [LICENSE](LICENSE). You can use
and modify it privately and non-commercially; you cannot sell it or offer it
as a commercial service.
