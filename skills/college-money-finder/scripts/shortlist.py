#!/usr/bin/env python3
"""Deterministic money-tier shortlist over data/colleges.csv.

Usage:
    python3 shortlist.py --profile profile.json [--csv path/to/colleges.csv]

profile.json:
{
  "sat": 1480,            // or null
  "act": null,            // or null
  "gpa": 3.9,             // unweighted, or null
  "budget": 40000,        // yearly, all-in
  "home_state": "NJ",     // two-letter; used only to prefer coa_in for in-state rows
  "regions": [],          // optional free-text region/state filter, empty = no filter
  "exclude": []           // school names to drop
}

Output: JSON to stdout — schools grouped by money tier with the numbers the
skill's writeup needs. The script only does arithmetic and thresholds; fit,
preference weighting, and narrative stay with the model.
"""
import argparse
import csv
import json
import math
import os
import sys

MERIT_RATE_TARGET = 0.15   # min share of no-need freshmen w/ merit for "conditional target"
FULLPAY_RATE = 0.05        # below this, school is effectively no-merit
BUDGET_SLACK = 3000        # allow price_after_merit to exceed budget by this much
INFLATION = 0.035          # per year, applied to dollar figures from older CDS years
CURRENT_CDS_YEAR = 2023    # start year of the newest CDS vintage in the dataset


def fnum(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def inflate(amount, row_year):
    """Bring an older CDS-year dollar figure up to the newest vintage."""
    if amount is None:
        return None
    try:
        start = int(str(row_year).split("-")[0])
    except ValueError:
        return amount
    years = max(0, CURRENT_CDS_YEAR - start)
    return round(amount * (1 + INFLATION) ** years)


def stat_position(row, profile):
    """top | mid | below | unknown, from SAT, then ACT, then GPA."""
    sat, act, gpa = profile.get("sat"), profile.get("act"), profile.get("gpa")
    s25, s75 = fnum(row.get("sat_25")), fnum(row.get("sat_75"))
    a25, a75 = fnum(row.get("act_25")), fnum(row.get("act_75"))
    if sat and s75:
        return "top" if sat >= s75 else ("mid" if s25 and sat >= s25 else "below")
    if act and a75:
        return "top" if act >= a75 else ("mid" if a25 and act >= a25 else "below")
    g = fnum(row.get("avg_gpa"))
    if gpa and g:
        return "top" if gpa >= g + 0.15 else ("mid" if gpa >= g - 0.2 else "below")
    return "unknown"


def classify(row, profile):
    budget = profile["budget"]
    in_state = profile.get("home_state") and row.get("state", "") == profile["home_state"]
    coa = fnum(row.get("coa_in") if in_state else row.get("coa_out")) or fnum(row.get("coa_out"))
    if coa is None:
        return None
    coa = inflate(coa, row.get("year"))
    merit_rate = fnum(row.get("pct_no_need_merit"))
    avg_merit = inflate(fnum(row.get("avg_merit")), row.get("year"))
    price_after = coa - avg_merit if avg_merit else None
    pos = stat_position(row, profile)

    if coa <= budget:
        tier = "lock"
    elif price_after is not None and price_after <= budget + BUDGET_SLACK:
        if merit_rate is not None and merit_rate >= MERIT_RATE_TARGET and pos in ("top", "mid"):
            tier = "conditional_target"
        else:
            tier = "merit_lottery"
    elif merit_rate is not None and merit_rate < FULLPAY_RATE:
        tier = "full_pay_or_bust"
    else:
        tier = "over_budget"  # merit exists but typical award doesn't close the gap

    return {
        "school": row["school"],
        "year": row.get("year"),
        "tier": tier,
        "stat_position": pos,
        "coa": coa,
        "in_state_price_used": bool(in_state),
        "merit_rate_no_need": merit_rate,
        "avg_merit": avg_merit,
        "price_after_merit": price_after,
        "avg_pct_need_met": fnum(row.get("avg_pct_need_met")),
        "meets_full_need": (fnum(row.get("avg_pct_need_met")) or 0) >= 95,
        "admit_rate": fnum(row.get("admit_rate")),
        "sat_75": fnum(row.get("sat_75")),
        "confidence": row.get("confidence"),
        "notes": (row.get("notes") or "")[:200],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True)
    ap.add_argument("--csv", default=os.path.join(os.path.dirname(__file__), "..", "data", "colleges.csv"))
    args = ap.parse_args()

    with open(args.profile) as f:
        profile = json.load(f)
    if not profile.get("budget"):
        sys.exit("profile.json needs a numeric 'budget'")

    exclude = {e.lower() for e in profile.get("exclude", [])}
    out = {"lock": [], "conditional_target": [], "merit_lottery": [],
           "full_pay_or_bust": [], "over_budget": [], "need_aid_check": []}

    with open(args.csv, newline="") as f:
        for row in csv.DictReader(f):
            if row["school"].lower() in exclude:
                continue
            r = classify(row, profile)
            if r is None:
                continue
            out[r["tier"]].append(r)
            if r["meets_full_need"] and r["tier"] in ("full_pay_or_bust", "over_budget"):
                out["need_aid_check"].append(r["school"])

    for tier in ("lock", "conditional_target", "merit_lottery"):
        out[tier].sort(key=lambda r: (-(r["merit_rate_no_need"] or 0), r["price_after_merit"] or r["coa"]))
    out["summary"] = {t: len(v) for t, v in out.items() if isinstance(v, list)}
    json.dump(out, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
