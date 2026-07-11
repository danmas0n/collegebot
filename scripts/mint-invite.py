#!/usr/bin/env python3
"""Mint invite codes for counseled.app tracker creation (owner-only tool).

Usage:
  GOOGLE_APPLICATION_CREDENTIALS=backend/service-account.json \
    python3 scripts/mint-invite.py [--count 1] [--days 30] [--note "for the Smiths"]

Prints one code per line. A code is single-use and expires after --days.
"""
import argparse
import secrets
import time

from google.cloud import firestore


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=1)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--note", default="")
    ap.add_argument("--project", default="collegebot-dev-52f43")
    args = ap.parse_args()

    db = firestore.Client(project=args.project)
    for _ in range(args.count):
        # readable, unambiguous: counseled-xxxx-xxxx
        code = "counseled-" + secrets.token_hex(2) + "-" + secrets.token_hex(2)
        db.collection("invite_codes").document(code).set({
            "created": time.strftime("%Y-%m-%d"),
            "expires": int((time.time() + args.days * 86400) * 1000),
            "note": args.note,
            "used_by": None,
        })
        print(code)


if __name__ == "__main__":
    main()
