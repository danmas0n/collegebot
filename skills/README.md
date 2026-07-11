# Counseled skills

The reimagined form of the collegebot project: instead of a hosted app, the
value ships as a dataset plus two skills.

## college-money-finder (customer-facing)

Interviews a family (student stats + what they'll actually pay), then uses
`data/colleges.csv` — merit-aid generosity extracted from 300+ official
Common Data Set filings — to build the family's **budget frontier**: financial
locks, conditional targets (the hidden fits: over-budget sticker but
realistic merit brings them under), merit lotteries, and honest
full-pay-or-bust calls. Delivers a counselor-style advice letter and a
persistent tracker artifact.

**Install on claude.ai:** zip the `college-money-finder` folder (the folder
itself at the zip root) and upload under Settings → Capabilities → Skills.
Works in Claude Code as-is (drop into `~/.claude/skills/` or a project
`.claude/skills/`).

## cds-refresh (maintainer-facing, Claude Code only)

The annual pipeline that rebuilds the dataset: source new-year CDS filings
(College Transitions repository + school IR pages), convert PDF/XLSX → text,
fan out extraction subagents, audit a sample, sanity-check, merge to
`colleges.csv`, and update `college-money-finder/data/`. The exact extraction
prompt/schema that produced the current data is in
`references/extraction-prompt.md`.

## Provenance

Dataset first built 2026-07 from the CDS corpus collected by the collegebot
project (`mcp/college-data-server/storage/`, 1,692 filings, 318 schools,
2017-18 → 2023-24; newest usable vintage per school used).
