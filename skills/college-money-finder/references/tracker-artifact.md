# The family tracker artifact

The tracker is the family's college search as one live page: the list grouped
by money tier, prices against the budget, deadlines, to-dos, and a journal.
It is a **self-saving Claude artifact**: the family's state is embedded in the
page as JSON, and every edit republishes the page with the new state through
the artifact's `artifact` capability. The page is the record. There is no
server.

Start from `assets/tracker-template.html`: replace only the JSON in
`<script type="application/json" id="state">`, never the rendering code, and
publish with `capabilities: {"artifact": {}}`. The family edits in the page
(status, tier, net price calculator results, to-dos, journal). You edit by
changing the state JSON and republishing the same artifact (pass its URL from
a new conversation).

## The state contract

```json
{
  "student": {"name": "", "grad_year": 2027, "gpa": null, "sat": null, "act": null},
  "budget": {"yearly": 40000, "notes": ""},
  "updated": "2026-07-10",
  "schools": [
    {"name": "", "tier": "lock|conditional_target|merit_lottery|long_shot",
     "status": "researching|visiting|applying|applied|admitted|denied|waitlisted|committed|dropped",
     "coa": 0, "merit_rate": 0.0, "avg_merit": 0, "est_price": 0,
     "npc_run": false, "npc_estimate": null,
     "deadlines": {"merit_priority": "", "ea": "", "rd": ""},
     "next_action": "", "notes": ""}
  ],
  "todos": [{"id": "", "text": "", "done": false, "school": "", "due": ""}],
  "log": [{"date": "", "entry": ""}]
}
```

Array order within a tier is the family's chosen order — preserve it.
`status: "dropped"` means archived (the page shows a restore button); never
delete school rows, and never remove journal entries.

## Working on an existing tracker

1. Read the published artifact first: the family may have edited it since you
   last saw it. Their edits win for statuses, tiers, order, net price
   results, to-dos and journal; your analysis wins for money fields you have
   just re-run.
2. Change the state, append a journal entry describing what you did and why
   (credit yourself: "(Claude)"), set `updated`, and republish.
3. Restate the top 3 next actions in chat.

A new test score or budget can flip tiers: offer a full frontier re-run rather
than editing numbers piecemeal.

## Sharing and extra views

Sharing is done by the family from the artifact's Share menu. Point them to
it; you never change who can see or edit the page. When they want a different
way to look at the list (cost vs. selectivity, a decision grid, a timeline),
build it as a separate artifact or add a section to this one, rendering from
the same state.
