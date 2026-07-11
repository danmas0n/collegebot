# Scoring methodology

The dataset (`data/colleges.csv`) has one row per school. The columns that
drive everything:

- `coa_out` — total yearly cost of attendance (out-of-state where applicable;
  `coa_in` for the family's home state).
- `pct_no_need_merit` — of freshmen who had **no financial need**, the share
  who received an institutional merit scholarship. This is the "families like
  us actually get money here" probability, derived from CDS H2A:
  `n_no_need_merit / (enrolled_ft_freshmen − n_with_need)`.
- `avg_merit` — average merit award to those students.
- `price_after_merit` — `coa_out − avg_merit`: what a typical winner pays.
- `sat_25`/`sat_75`, `act_25`/`act_75`, `avg_gpa`, `pct_top_10` — for judging
  where the student sits in the school's distribution.
- `avg_pct_need_met`, `pct_need_fully_met` — for the need-aid lens.
- `confidence`, `notes` — extraction confidence and known warts. Treat
  `low`-confidence rows as leads to verify, not facts.

## Student stat percentile

Classify the student against each school:

- **top-quartile**: SAT/ACT ≥ the school's 75th percentile (or, if
  test-optional and no score, GPA comfortably above the school's average and
  top-10% rank where the school reports it matters).
- **mid-band**: between 25th and 75th.
- **below-band**: under the 25th.

Merit probability adjustment: the CSV's `pct_no_need_merit` is a base rate
across all no-need freshmen. A top-quartile student's real odds are higher
than the base rate; a below-band student's are near zero regardless of the
base rate. Don't fabricate precision — use the base rate plus the student's
percentile position as a qualitative multiplier (state it as "better/worse
than the listed rate", not a made-up number).

## Money tiers

For a family budget **B** per year (use `coa_in` for in-state schools,
`coa_out` otherwise):

| Tier | Rule | Meaning |
|---|---|---|
| **Lock** | `coa ≤ B`, or the school has automatic/formulaic merit (stats-based grids, National Merit packages) that brings a qualifying student under B | Financial safety school. |
| **Conditional target** | `coa > B`, `price_after_merit ≤ B` (allow ~$3k slack), `pct_no_need_merit ≥ 15%`, and student is mid-band or better — top-quartile strongly preferred | The hidden fits. The whole point of this skill. |
| **Merit lottery** | `price_after_merit ≤ B` but `pct_no_need_merit < 15%`, or awards concentrated in a handful of named full rides | Possible, not plannable. Cap how many the family invests in. |
| **Full-pay-or-bust** | `pct_no_need_merit < ~5%` and `coa > B` | Elites and meets-full-need LACs. Only via need aid or full pay. |

Where a school's merit is athletic-heavy (see `notes` / `n_athletic` vs
`n_no_need_merit`), discount accordingly for non-athletes.

## The need-aid lens (run when income < ~$150k)

For meets-full-need schools (`avg_pct_need_met ≥ 95`), a moderate-income
family's net price can undercut every merit school. You cannot compute their
need from the interview data (by design), so: present the top such schools as
a separate "check your need-based price" list, and send the family to those
schools' Net Price Calculators. Never guess a need-based award.

## Applicability filters the script can't do

`shortlist.py` is arithmetic only — before presenting its output, drop rows
that don't apply to this student. In particular the dataset includes
**women's colleges** (Agnes Scott, Barnard, Bryn Mawr, Mount Holyoke,
Scripps, Smith, Spelman, Wellesley, and similar) and **service academies**
(free but a completely different commitment — mention only when relevant).
Also weigh single-department fit: a school with no program in the student's
field doesn't belong on the list no matter how good the money is.

## Composing the frontier

The deliverable is not "every school that passes a filter" — it's a curated
frontier. Aim for 8–15 schools total:

- 2–3 locks (must include the in-state flagship or honors college unless
  disqualified by preference; say why if excluded).
- 5–8 conditional targets, ranked by (a) fit with stated preferences,
  (b) `pct_no_need_merit`, (c) how comfortably `price_after_merit` clears the
  budget. Lead the narrative with the 2–3 most surprising.
- 0–3 lotteries, clearly labeled.
- If the family named dream schools that land in full-pay-or-bust, address
  them explicitly and respectfully — show the math rather than dismissing.

For every school in the frontier, the writeup line is:
**School — sticker $X → merit rate Y% of no-need freshmen, avg award $Z →
typical winner pays ~$W. Student sits [percentile position]. [One sentence of
fit/why].**

## Honest-uncertainty rules

- Cite the CDS year per school (the `year` column) — data lags one to two
  years and prices rise ~3–4%/yr; inflate old COA figures and say you did.
- Averages hide spread: an "avg $25k" program may be a few full rides plus
  many $10k awards. Where `notes` flags this, pass the flag on.
- The conversion from base rate to this student's odds is judgment, not
  math. Keep the language calibrated ("roughly one in three similar
  admits...", "realistic but not likely").
