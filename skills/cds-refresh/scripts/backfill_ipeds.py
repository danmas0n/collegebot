#!/usr/bin/env python3
"""Backfill missing COA totals in colleges.csv from IPEDS derived charges.

Usage:
  python3 backfill_ipeds.py --csv colleges.csv --hd HD<year>.csv --drv drvic<year>.csv

Downloads (no API key needed):
  https://nces.ed.gov/ipeds/datacenter/data/DRVIC<year>.zip  (CINSON/COTSON = total price on-campus)
  https://nces.ed.gov/ipeds/datacenter/data/HD<year>.zip     (institution names/states)

Rows whose coa_in/coa_out are empty get IPEDS values and the flag
`coa_from_ipeds`. Matching is by normalized name, disambiguated by state.
IPEDS "total price" includes tuition/fees, housing/food, books, and other
expenses — same construct as CDS G1.
"""
import argparse
import csv
import sys


def norm(name):
    """Compare IPEDS vs CDS names: hyphens→spaces, drop campus suffixes and
    'the', then compare alphanumerics only ('Texas A & M' == 'Texas A&M')."""
    n = name.lower().replace("-", " ").replace("–", " ").replace("/", " ")
    for word in (" main campus", " twin cities campus", " campus", "the "):
        n = n.replace(word, " ")
    return "".join(c for c in n if c.isalnum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--hd", required=True)
    ap.add_argument("--drv", required=True)
    args = ap.parse_args()

    names = {}  # unitid -> (name, state)
    with open(args.hd, encoding="utf-8-sig", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            names[r["UNITID"]] = (r["INSTNM"], r["STABBR"])

    # (normname, state) -> (cinson, cotson); also normname-only for fallback
    by_key, by_name = {}, {}
    with open(args.drv, encoding="utf-8-sig", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            uid = r["UNITID"]
            if uid not in names:
                continue
            name, st = names[uid]
            vals = (r.get("CINSON") or None, r.get("COTSON") or None)
            if not any(vals):
                continue
            by_key[(norm(name), st)] = vals
            by_name.setdefault(norm(name), []).append((st, vals))

    with open(args.csv, newline="") as f:
        rows = list(csv.DictReader(f))
        cols = f.name and rows and list(rows[0].keys())

    filled, unmatched = 0, []
    for row in rows:
        if row.get("coa_out") and row.get("coa_in"):
            continue
        key = (norm(row["school"]), row.get("state", ""))
        vals = by_key.get(key)
        if vals is None:
            cands = by_name.get(key[0], [])
            vals = cands[0][1] if len(cands) == 1 else None
        if vals is None:
            unmatched.append(row["school"])
            continue
        cin, cout = vals
        changed = False
        if not row.get("coa_in") and cin:
            row["coa_in"] = cin
            changed = True
        if not row.get("coa_out") and cout:
            row["coa_out"] = cout
            changed = True
        if changed:
            row["flags"] = ";".join(x for x in [row.get("flags", ""), "coa_from_ipeds"] if x)
            # keep price_after_merit consistent with the new sticker
            if row.get("avg_merit") and row.get("coa_out"):
                row["price_after_merit"] = str(int(float(row["coa_out"]) - float(row["avg_merit"])))
            filled += 1

    with open(args.csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"backfilled {filled} rows; unmatched: {unmatched or 'none'}")
    sys.exit(0)


if __name__ == "__main__":
    main()
