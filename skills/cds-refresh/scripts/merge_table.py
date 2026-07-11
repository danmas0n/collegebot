#!/usr/bin/env python3
"""Merge per-school extraction JSONs into colleges.csv with derived fields
and sanity flags.

Usage:
  python3 merge_table.py <extracted_dir> --out colleges.csv \
      [--states school-states.csv] [--prev old-colleges.csv] [--check]

--check: print flagged rows and exit (no CSV written).
--prev:  carry forward schools missing from this run (flagged stale) and flag
         >40% year-over-year swings in key dollar fields.

Rates are written as fractions (0-1); dollars as plain numbers.
"""
import argparse
import csv
import glob
import json
import os
import sys

COLUMNS = [
    "school", "state", "region", "year", "confidence", "flags",
    "applied", "admitted", "admit_rate", "enrolled_ft_freshmen",
    "sat_25", "sat_75", "act_25", "act_75", "avg_gpa", "pct_top_10", "test_policy",
    "tuition_in", "tuition_out", "coa_in", "coa_out",
    "n_with_need", "n_no_need", "n_no_need_merit", "pct_no_need_merit",
    "avg_merit", "price_after_merit", "n_athletic", "avg_athletic",
    "pct_need_fully_met", "avg_pct_need_met", "avg_need_based_award",
    "notes",
]


def norm(name):
    """Match school names across sources despite punctuation drift
    ('Lewis & Clark' vs 'Lewis  Clark', 'St. John's' vs 'St John s')."""
    return "".join(c for c in name.lower() if c.isalnum())


def div(a, b):
    return round(a / b, 4) if a is not None and b else None


def flags_for(row):
    f = []
    coa, merit = row.get("coa_out"), row.get("avg_merit")
    if merit and coa and merit >= coa:
        f.append("merit_gte_coa")
    if row.get("coa_estimated"):
        f.append("coa_estimated_from_components")
    n_merit, n_no_need = row.get("n_no_need_merit"), row.get("n_no_need")
    if n_merit and n_no_need and n_merit > n_no_need:
        f.append("merit_rate_clamped_denominator_approx")
    ar = row.get("admit_rate")
    if ar is not None and not 0.005 <= ar <= 0.99:
        f.append("admit_rate_out_of_range")
    for k in ("sat_25", "sat_75"):
        v = row.get(k)
        if v is not None and not 600 <= v <= 1600:
            f.append(f"{k}_out_of_range")
    if coa is not None and not 15000 <= coa <= 100000:
        f.append("coa_out_of_range")
    return f


def yoy_flags(row, prev):
    f = []
    for k in ("coa_out", "avg_merit", "avg_need_based_award"):
        new, old = row.get(k), prev.get(k)
        try:
            old = float(old) if old not in (None, "") else None
        except ValueError:
            old = None
        if new and old and old > 0 and abs(new - old) / old > 0.40:
            f.append(f"yoy_swing_{k}")
    return f


def load_extracted(path):
    j = json.load(open(path))
    adm, cost, need, merit = j["admissions"], j["cost"], j["need_aid"], j["merit"]
    enrolled, n_need = adm.get("enrolled_ft_freshmen"), need.get("n_with_need")
    n_no_need = (enrolled - n_need) if enrolled is not None and n_need is not None else None
    coa_out, avg_merit = cost.get("coa_total_outstate"), merit.get("avg_no_need_merit")
    # G1 totals are missing in ~20% of filings; derive from components where
    # possible (books/personal estimated at $3,400) rather than dropping the row
    coa_estimated = False
    fh = cost.get("food_housing")
    if coa_out is None and cost.get("tuition_fees_outstate") and fh:
        coa_out = cost["tuition_fees_outstate"] + fh + 3400
        coa_estimated = True
    coa_in = cost.get("coa_total_instate")
    if coa_in is None and cost.get("tuition_fees_instate") and fh:
        coa_in = cost["tuition_fees_instate"] + fh + 3400
        coa_estimated = True
    row = {
        "school": j["school"], "year": j["year"], "confidence": j["confidence"],
        "notes": (j.get("notes") or "").replace("\n", " "),
        "applied": adm.get("applied"), "admitted": adm.get("admitted"),
        "admit_rate": div(adm.get("admitted"), adm.get("applied")),
        "enrolled_ft_freshmen": enrolled,
        "sat_25": adm.get("sat_25"), "sat_75": adm.get("sat_75"),
        "act_25": adm.get("act_25"), "act_75": adm.get("act_75"),
        "avg_gpa": adm.get("avg_gpa"), "pct_top_10": adm.get("pct_top_10"),
        "test_policy": adm.get("test_policy"),
        "tuition_in": cost.get("tuition_fees_instate"), "tuition_out": cost.get("tuition_fees_outstate"),
        "coa_in": coa_in, "coa_out": coa_out,
        "coa_estimated": coa_estimated,
        "n_with_need": n_need, "n_no_need": n_no_need,
        # ratio can exceed 1.0 because (enrolled − with-need) only approximates
        # the H2A no-need population (aid non-applicants land in neither bucket);
        # clamp for usability, flags_for() marks the raw overflow
        "n_no_need_merit": merit.get("n_no_need_merit"),
        "pct_no_need_merit": min(1.0, div(merit.get("n_no_need_merit"), n_no_need) or 0) or None,
        "avg_merit": avg_merit,
        "price_after_merit": (coa_out - avg_merit) if coa_out and avg_merit else None,
        "n_athletic": merit.get("n_athletic"), "avg_athletic": merit.get("avg_athletic"),
        "pct_need_fully_met": need.get("pct_need_fully_met"),
        "avg_pct_need_met": need.get("avg_pct_need_met"),
        "avg_need_based_award": need.get("avg_need_based_award"),
    }
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("extracted_dir")
    ap.add_argument("--out", default="colleges.csv")
    ap.add_argument("--states", default=os.path.join(os.path.dirname(__file__), "..", "references", "school-states.csv"))
    ap.add_argument("--prev")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    states = {}
    if os.path.exists(args.states):
        with open(args.states, newline="") as f:
            for r in csv.DictReader(f):
                states[norm(r["school"])] = (r.get("state", ""), r.get("region", ""))

    prev = {}
    if args.prev and os.path.exists(args.prev):
        with open(args.prev, newline="") as f:
            for r in csv.DictReader(f):
                prev[norm(r["school"])] = r

    rows, flagged, by_key = [], [], {}
    for path in sorted(glob.glob(os.path.join(args.extracted_dir, "*.json"))):
        try:
            row = load_extracted(path)
        except (KeyError, json.JSONDecodeError) as e:
            flagged.append((os.path.basename(path), [f"unparseable: {e}"]))
            continue
        key = norm(row["school"])
        # duplicate filings for one school (filename variants): keep the row
        # with more filled fields, tiebreak on newer year
        if key in by_key:
            score = lambda r: (sum(1 for v in r.values() if v not in (None, "")), str(r.get("year")))
            if score(row) <= score(by_key[key]):
                continue
            rows.remove(by_key[key])
        by_key[key] = row
        row["state"], row["region"] = states.get(key, ("", ""))
        f = flags_for(row)
        if key in prev:
            f += yoy_flags(row, prev[key])
        row["flags"] = ";".join(f)
        if f:
            flagged.append((row["school"], f))
        rows.append(row)

    seen = {norm(r["school"]) for r in rows}
    for key, old in prev.items():
        if key not in seen:
            old = dict(old)
            old["flags"] = (old.get("flags", "") + ";stale_carried_forward").strip(";")
            rows.append(old)

    if flagged:
        print(f"{len(flagged)} flagged rows:", file=sys.stderr)
        for school, f in flagged:
            print(f"  {school}: {', '.join(f)}", file=sys.stderr)
    if args.check:
        sys.exit(0)

    rows.sort(key=lambda r: r["school"])
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
