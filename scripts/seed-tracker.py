#!/usr/bin/env python3
"""One-time seed of the family tracker document (trackers/julia) in Firestore.

Run:  GOOGLE_APPLICATION_CREDENTIALS=backend/service-account.json python3 scripts/seed-tracker.py
Requires: pip install google-cloud-firestore (or use the session venv).

Adds Dan's email to allowed_emails; add Julia's/family emails afterwards with:
  python3 skills/college-money-finder/scripts/sync_tracker.py allow julia --email <email>
"""
import json
import os
import sys

from google.cloud import firestore

STATE_FILE = os.path.join(os.path.dirname(__file__), "seed-tracker-state.json")

state = json.load(open(STATE_FILE))
db = firestore.Client(project="collegebot-dev-52f43")
doc = db.collection("trackers").document("julia")
if doc.get().exists and "--force" not in sys.argv:
    sys.exit("trackers/julia already exists — pass --force to overwrite")
doc.set({
    "allowed_emails": ["dan.mason@gmail.com"],
    "state": state,
})
print(f"seeded trackers/julia: {len(state['schools'])} schools, {len(state['todos'])} todos")
