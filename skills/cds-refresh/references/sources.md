# Where Common Data Set files live

## Our own archive (check FIRST before re-downloading anything)

The full corpus collected by the collegebot project is archived at
`gs://counseled-cds-archive` (project collegebot-dev-52f43, ARCHIVE storage
class — pennies/year, but retrievals bill per-GB, so pull only what you need):

- `raw-cds-corpus/` — 1,692 original filings (PDF/XLSX), 318 schools,
  2017-18 → 2023-24. This is the only copy besides Dan's laptop
  (`mcp/college-data-server/storage/`, which is gitignored). Never delete
  either without confirming the other exists.
- `derivatives/cds-derivatives-2026-07.tar.gz` — the July 2026 extraction
  run: plain-text conversions (`cds_text/`), per-school extraction JSONs
  (`extracted/`), and the manifest. Re-running analysis on the same vintage
  starts here, not from the PDFs.

Restore: `gcloud storage rsync --recursive gs://counseled-cds-archive/raw-cds-corpus <dest>`

There is no central government repository — CDS is a voluntary standardized
survey (College Board / Peterson's / U.S. News collaboration; official site
commondataset.org hosts the blank form, not filings). Filings are published
by each school's institutional research (IR) office, and mirrored by a few
aggregators.

## Primary sources, in order of convenience

1. **College Transitions CDS repository**
   `https://www.collegetransitions.com/dataverse/common-data-set-repository/`
   One page, hundreds of schools, years 2017-18 → current, links mostly to
   Google Drive copies (mix of PDF and Google Sheets). This is the bulk
   source: fetch the page, parse the school-name rows, take the newest-year
   link per school. Google Sheets links can be downloaded as .xlsx by
   rewriting to `.../export?format=xlsx`. Not every cell is linked — blanks
   mean they haven't collected that school/year.

2. **School IR pages** (authoritative, covers gaps)
   Search recipe that works: `"<school name>" "common data set" 2025-2026 site:.edu`
   IR URLs are stable year to year (e.g. `opir.columbia.edu/cds`,
   `ira.upenn.edu/penn-numbers/common-data-set`, `oira.harvard.edu/...`,
   `irpa.umd.edu/InstitutionalData/cds.html`, `ir.aa.ufl.edu/reports/cds-reports/`).
   Once a school's IR URL is known, record it in `known-ir-pages.csv` (create
   on first run) and check it directly next year before searching.

3. **IPEDS / College Scorecard** (not CDS, but fills different columns)
   Clean federal bulk data for every school: admissions, costs, net price by
   income bracket. `https://collegescorecard.ed.gov/data/` (API + full CSV) and
   `https://nces.ed.gov/ipeds/use-the-data`. These do NOT contain the H2A
   merit-to-no-need split — that's the one thing only CDS has — but they're
   the right backstop for COA/admissions fields and for schools with no CDS.

## Publication rhythm

A "2025-26" CDS describes fall-2025 entrants and is published rolling from
~December 2025 through summer 2026. Best single time to run a full refresh:
**June–July**. Expect ~10–15% of schools to be late or to skip a year;
carrying forward the prior year (marked stale) is normal.

## Format notes

- ~80% PDF, ~15% XLSX, occasional HTML pages (save as PDF or parse directly).
- A few schools publish scanned/image PDFs that yield no text (historically:
  Saint Louis, Syracuse, Cal Poly SLO some years). For these, look for an
  earlier HTML/XLSX vintage or their IR page's alternate format before
  considering OCR.
- School name matching between the aggregator index and the tracked list is
  fuzzy (punctuation, "University of X" vs "X University"). Match loosely and
  verify by checking the school name printed inside the file (section A1).
