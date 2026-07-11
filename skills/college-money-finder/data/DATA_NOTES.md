# Dataset notes — colleges.csv

**What this is:** one row per U.S. college, extracted from each school's own
Common Data Set (CDS) filing — the standardized survey colleges complete for
College Board / Peterson's / U.S. News. The merit-aid columns come from CDS
Section H2A, which reports how many enrolled freshmen with **no financial
need** received institutional non-need-based (merit) scholarships, and the
average dollar amount. Schools self-report; nobody audits them.

**Vintage:** built July 2026; 310 schools. Most rows are the 2023-24 CDS
(fall-2023 entrants); a minority are older where that was the newest
machine-readable filing (see each row's `year`). Dollar figures from older
vintages should be inflated ~3.5%/yr — `shortlist.py` does this
automatically.

**Extraction:** automated — one Haiku extraction agent per school over the
filing text; 24 schools independently audited by Sonnet (4 minor
discrepancies found and fixed, none in merit fields); 49 suspicious or
low-confidence rows fully re-verified by Sonnet against sources.
`confidence` records the final assessment; `flags` records mechanical
sanity-check hits (including `coa_estimated_from_components` where the G1
total was derived as tuition + housing + $3,400, and
`merit_rate_clamped_denominator_approx` where the school's own H2/H2A
numbers are internally inconsistent — the derived rate is clamped to 100%).
Treat `low` confidence or flagged rows as leads, not facts.

## Column reference

Rates are fractions (0–1). Dollars are per-year. Aid columns describe
**full-time first-time freshmen**, not all undergrads.

| Column | Meaning |
|---|---|
| `pct_no_need_merit` | Share of no-need freshmen who received institutional merit aid — the "families like us get money here" base rate |
| `avg_merit` | Average merit award to those students |
| `price_after_merit` | `coa_out − avg_merit`: what a typical winner pays |
| `n_no_need` | Number of freshmen with no financial need (denominator) |
| `n_athletic`, `avg_athletic` | Athletic awards (separate system — exclude for non-athletes) |
| `coa_in`, `coa_out` | Total yearly cost of attendance, in-/out-of-state (equal at privates) |
| `avg_pct_need_met`, `pct_need_fully_met` | Need-based generosity (the other lens) |
| `admit_rate`, `sat_25/75`, `act_25/75`, `avg_gpa`, `pct_top_10` | For placing a student in the school's distribution |
| `confidence`, `flags`, `notes` | Data-quality signals — surface these when citing a school |

## Known limitations (tell families these)

1. **Lag:** CDS data describes students who enrolled 1–3 years ago. Programs
   change; a shortlist must be verified against schools' current scholarship
   pages and Net Price Calculators.
2. **Averages hide spread:** "avg $25k" can be a few full rides plus many
   small awards.
3. **Definitional wobble:** a few schools lump state grants or athletic money
   into H2A, or report the section inconsistently year to year. Flagged in
   `notes` where detected.
4. **The base rate is not this student's probability.** It's the floor of
   the conversation, adjusted by where the student sits in the school's
   stats distribution.
5. **Missing schools** (no machine-readable CDS found): Saint Louis
   University, Syracuse University — verify via their NPCs directly.
6. **Null aid sections that are the school's doing, not ours:** Clemson
   suppresses its H tables ("confidential"), Davidson and DePaul published
   blank/unfilled forms for the year captured, Middlebury and CUNY Baruch
   omit the sections, MIT reports no merit because it awards none.
7. **COA provenance:** rows flagged `coa_from_ipeds` (50 schools) use the
   federal IPEDS 2023-24 "total price, on-campus" figure because the school's
   CDS omitted a G1 total; rows flagged `coa_estimated_from_components` were
   summed from tuition + housing + $3,400. Only the two service academies
   have no sticker price (by design).
