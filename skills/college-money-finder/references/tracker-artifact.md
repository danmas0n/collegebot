# The family tracker artifact (editable)

The tracker is the family's college search rendered as a single living
dashboard — their list grouped by money tier, with prices, statuses,
deadlines, to-dos, notes, and a journal. **It is directly editable in the
page**: the family can add/archive/reorder schools, change tiers and
statuses, keep to-dos, and journal — and Claude edits the same state when it
republishes. Start from `assets/tracker-template.html`; replace only the
JSON in `#tracker-state`, never the rendering code.

## The state contract

One JSON object in `<script type="application/json" id="tracker-state">`:

```json
{
  "baseline_version": 1,
  "student": {"name": "", "grad_year": 2027, "gpa": null, "sat": null, "act": null},
  "budget": {"yearly": 40000, "notes": ""},
  "updated": "2026-07-10",
  "schools": [
    {"name": "", "tier": "lock|conditional_target|merit_lottery|long_shot",
     "status": "researching|visiting|applying|applied|admitted|denied|committed|dropped",
     "coa": 0, "merit_rate": 0.0, "avg_merit": 0, "est_price": 0,
     "npc_run": false, "npc_estimate": null,
     "lat": null, "lng": null,
     "deadlines": {"merit_priority": "", "ea": "", "rd": ""},
     "next_action": "", "notes": ""}
  ],
  "todos": [{"id": "", "text": "", "done": false, "school": "", "due": ""}],
  "log": [{"date": "", "entry": ""}]
}
```

Array order within a tier is the family's chosen order — preserve it.
`status: "dropped"` means archived (the page shows it in a collapsed
section with a restore button); never delete school rows.

Always include `lat`/`lng` (approximate main-campus coordinates — you know
them; no geocoding call needed) when adding a school: the live tracker page
renders a map of the list, color-coded by money tier, once coordinates
exist. Maintain them on Claude's side; families won't type coordinates.

## The sync loop (how edits flow both ways)

- **Family → Claude:** the page's **Copy for Claude** button exports the
  full state JSON with a preamble asking Claude to merge and republish. When
  a user pastes such an export, MERGE it: **the export wins** for
  user-owned fields (status, tier, order, notes, todos, log, archived,
  added schools); **your analysis wins** for data-owned fields (coa,
  merit_rate, avg_merit, and est_price when you re-run the numbers). Then
  bump `baseline_version`, set `updated`, append a journal entry describing
  what you changed, and republish.
- **Claude → family:** every republish is a new baseline. Always bump
  `baseline_version` — the page uses it to detect that Claude shipped a
  newer version than the viewer's stored edits and warns instead of
  silently discarding either side.

## Runtime differences (pick behavior by environment)

- **Live mode via the Counseled connector (preferred):** if a `counseled`
  MCP connector is available in this environment, use its tools instead of
  anything below: `list_trackers` → `get_tracker` → merge per the rules
  above → `update_tracker` with a one-sentence `session_note`. The family's
  page at counseled.app/tracker/?t=<id> updates live; the server enforces
  the guardrails (no school deletion, journal append-only) and provenance.
- **Live mode via service account (maintainer fallback, Claude Code only):**
  same Firestore documents through `scripts/sync_tracker.py` (pull → merge →
  push). Append a journal entry crediting "Claude" on every push. Add family
  members with `sync_tracker.py allow <id> --email <email>`.

- **Claude Code artifacts** (claude.ai/code/artifact/…): static — the page
  has NO storage; in-page edits are session-only and Copy-for-Claude is the
  save. Keep the canonical state in a file too (suggest
  `college-search/tracker.json` in a git repo) so the artifact can always be
  rebuilt. Note: on Pro/Max plans these artifacts are visible only to the
  publishing account — for multi-person family viewing, share the HTML file
  or use the claude.ai path.
- **claude.ai published artifacts**: support persistent storage (Pro+
  plans, text, ≤20MB, only after publishing; deleted if unpublished). Wire
  the template's `PERSIST.load/save` hooks to the artifact storage API
  available in your runtime, using **shared** storage so parents and
  student co-edit one list (a first-use consent dialog appears — tell the
  family to expect it). Keep the embedded baseline current anyway: storage
  can be lost, the baseline is the floor.

## Rendering rules (already implemented in the template)

- One calm, phone-first screen. Header: student, budget, updated, Edit +
  Copy-for-Claude toolbar with an unsaved-changes indicator.
- "Needs attention" strip: deadlines within 45 days, to-dos due within 7,
  anything overdue. Merit-priority deadlines outrank admission deadlines.
- Tier sections in order (locks → conditional targets → lotteries → long
  shots); each school card: price bar vs the budget rule, sticker/merit
  rate/avg award/est or NPC price, next action, nearest deadline, notes.
- Edit mode adds per-card controls (reorder, tier/status selects, edit
  dialog, add-todo, archive) and an Add-school dialog. To-dos and journal
  accept new entries in both modes.

## Session discipline

When a conversation touches the college search: ingest any pasted export →
merge → re-run affected analysis (a new test score can flip tiers — offer
the full frontier re-run, don't just edit numbers) → append to the journal
→ republish → restate the top 3 next actions in chat.
