#!/usr/bin/env python3
"""Claude-side read/write access to a live family tracker in Firestore.

The tracker page (counseled.app/tracker/?t=<id>) and this script share one
document: trackers/<id> = { allowed_emails: [...], state: {...} }.
The state contract and merge discipline are documented in
references/tracker-artifact.md — family edits win for statuses/notes/todos/
order/journal; re-run analysis before changing money fields.

Usage:
  python3 sync_tracker.py pull <tracker_id> [--out state.json]
  python3 sync_tracker.py push <tracker_id> --state state.json
  python3 sync_tracker.py allow <tracker_id> --email person@example.com

Auth: set GOOGLE_APPLICATION_CREDENTIALS to the Firebase service-account
JSON (the collegebot backend's service-account.json works), or run where
application-default credentials exist. Requires google-cloud-firestore.
"""
import argparse
import json
import sys

from google.cloud import firestore


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["pull", "push", "allow"])
    ap.add_argument("tracker_id")
    ap.add_argument("--state")
    ap.add_argument("--email")
    ap.add_argument("--out")
    ap.add_argument("--project", default="collegebot-dev-52f43")
    args = ap.parse_args()

    ref = firestore.Client(project=args.project).collection("trackers").document(args.tracker_id)

    if args.action == "pull":
        snap = ref.get()
        if not snap.exists:
            sys.exit(f"trackers/{args.tracker_id} does not exist")
        payload = json.dumps(snap.to_dict()["state"], indent=1)
        if args.out:
            open(args.out, "w").write(payload)
            print(f"wrote {args.out}")
        else:
            print(payload)

    elif args.action == "push":
        if not args.state:
            sys.exit("push requires --state file")
        state = json.load(open(args.state))
        for key in ("student", "budget", "schools", "todos", "log", "updated"):
            if key not in state:
                sys.exit(f"state missing required key: {key}")
        ref.set({"state": state}, merge=True)
        print(f"pushed state to trackers/{args.tracker_id} "
              f"({len(state['schools'])} schools, {len(state['todos'])} todos)")

    elif args.action == "allow":
        if not args.email:
            sys.exit("allow requires --email")
        ref.update({"allowed_emails": firestore.ArrayUnion([args.email])})
        print(f"added {args.email} to trackers/{args.tracker_id}")


if __name__ == "__main__":
    main()
