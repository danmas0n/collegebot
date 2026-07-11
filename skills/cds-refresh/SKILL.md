---
name: cds-refresh
description: >-
  Maintainer skill: refresh the college merit-aid dataset that powers the
  college-money-finder skill. Finds and downloads new-year Common Data Set
  (CDS) filings for the tracked schools, extracts the key admissions/cost/
  merit-aid fields with parallel subagents, sanity-checks the results, and
  rebuilds data/colleges.csv. Use when asked to update/refresh the CDS data,
  add schools to the dataset, re-run extraction, or produce the annual
  "merit aid almanac" update. Requires Claude Code (subagents + filesystem).
---

# CDS Refresh

Annual (or on-demand) pipeline that keeps `college-money-finder/data/`
current. The pipeline is: **source → convert → extract → verify → merge →
publish**. Each stage is restartable; state lives in a working directory as
plain files.

Read `references/sources.md` before sourcing — it records where CDS files
live and the search recipes that work.

## 0. Setup

Working dir: `cds-refresh-work/<year>/` (e.g. `2025-26/`) with subdirs
`raw/` (downloaded pdf/xlsx), `text/`, `extracted/`. The tracked-school list
is the `school` column of the current `colleges.csv`; additions welcome.

Python needs `pypdf` and `openpyxl` (venv is fine).

## 1. Source new filings

For each tracked school, in priority order:

1. **College Transitions repository** — one page indexing hundreds of schools
   × years with Google Drive links. Fetch the index, match school names,
   download the target year's file.
2. **The school's own institutional research page** — web-search
   `"<school>" "common data set" <year> site:.edu`, follow to the IR page,
   download the PDF/XLSX. This is the authoritative copy and covers schools
   the aggregator misses.
3. Give up gracefully — record the school in `missing.json` and keep the
   prior year's row (marked stale) in the merge.

Schools publish on a rolling basis (roughly Dec–June for the year that
started the prior fall); a refresh run before spring will legitimately find
many gaps. Log the hit rate.

## 2. Convert to text

Run `scripts/convert_cds.py raw/ text/`. It handles PDF (pypdf) and XLSX
(openpyxl, sheets flattened to TSV). Files that yield <500 chars are usually
scanned images — list them in `missing.json` (or OCR them if tooling exists;
don't build OCR just for a few schools, re-source an XLSX/HTML copy instead).

## 3. Extract with parallel subagents

Fan out one extraction agent per school over `text/` (Haiku-class model is
sufficient and cheap; 300 schools ≈ a few dollars). Each agent reads the text
and returns the JSON schema in `references/extraction-prompt.md` — that file
contains the exact prompt and schema that produced the current dataset. Keep
them in sync: if you change the schema, change the merge script and the
DATA_NOTES documentation in the same run.

Have a stronger model (Sonnet-class) independently re-extract a ~10% sample
and diff the key fields (`n_no_need_merit`, `avg_no_need_merit`, `coa_*`,
applied/admitted). If mismatch rate > ~5% of sampled schools, tighten the
prompt and re-run extraction rather than hand-patching at scale.

## 4. Sanity-check

Run `scripts/merge_table.py --check extracted/`. It flags, without failing:

- `avg_no_need_merit` ≥ `coa_total` (almost always a misread — e.g. the COA
  figure landed in the merit field),
- merit rate > 60% of no-need freshmen (possible, rare — verify),
- admit rate outside (0.5%, 99%), SAT bounds, COA outside ($15k, $100k),
- year-over-year swings > 40% vs the previous colleges.csv.

Re-check every flagged school against its source text with a fresh agent
before accepting. Record irreducible weirdness in the row's `notes` instead
of silently "fixing" it.

## 5. Merge and publish

`scripts/merge_table.py extracted/ --prev <old colleges.csv> --out colleges.csv`
computes the derived columns (`pct_no_need_merit`, `price_after_merit`,
`admit_rate`), joins the static `school → state/region` mapping
(`references/school-states.csv` — extend it for new schools), and carries
forward stale rows.

Then:

1. Copy `colleges.csv` into `college-money-finder/data/` AND
   `counseled-mcp/data/` (the connector serves the same dataset via
   search_colleges; redeploy the Cloud Run service after updating).
2. Update `college-money-finder/data/DATA_NOTES.md`: vintage counts, schools
   added/dropped/stale, notable changes (schools whose merit programs
   appeared/vanished), extraction audit stats.
3. Re-zip/re-distribute college-money-finder wherever it's installed
   (claude.ai uploads don't auto-update).
4. Optional but valuable: write the year's "what changed" almanac summary —
   the most/least merit-generous lists make good public content.
