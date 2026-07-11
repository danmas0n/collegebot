#!/usr/bin/env python3
"""End-to-end test of counseled-mcp against local emulators:
seed tracker -> register OAuth client -> authorize -> consent (emulator ID
token) -> PKCE token exchange -> MCP initialize/list/call -> update_tracker
-> verify guardrails (school deletion refused) and scoping (stranger denied).
"""
import base64
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.parse
import urllib.request

BASE = "http://localhost:8787"
EMAIL = "testparent@example.com"
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:8080")

PASS = 0

def check(name, cond, detail=""):
    global PASS
    tag = "PASS" if cond else "FAIL"
    print(f"[{tag}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if cond: PASS += 1
    else: sys.exit(f"aborting on failed check: {name} {detail}")

def http(method, url, body=None, headers=None, form=False):
    data = None
    h = dict(headers or {})
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)

# --- 0. seed a tracker in the Firestore emulator (via REST) ---
state = {
    "baseline_version": 1, "updated": "2026-07-10",
    "student": {"name": "Test Student", "grad_year": 2027, "gpa": 3.8, "sat": 1450, "act": None},
    "budget": {"yearly": 35000, "notes": ""},
    "schools": [
        {"name": "Test University", "tier": "lock", "status": "researching", "coa": 30000,
         "merit_rate": 0.5, "avg_merit": 8000, "est_price": 22000, "npc_run": False,
         "npc_estimate": None, "deadlines": {}, "next_action": "", "notes": ""}
    ],
    "todos": [], "log": [{"date": "2026-07-10", "entry": "seeded"}],
}
def fs_value(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if v is None: return {"nullValue": None}
    if isinstance(v, (int, float)): return {"doubleValue": v} if isinstance(v, float) else {"integerValue": str(v)}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [fs_value(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: fs_value(x) for k, x in v.items()}}}
    raise TypeError(v)

doc = {"fields": {"allowed_emails": fs_value([EMAIL]), "state": fs_value(state)}}
st, body, _ = http("PATCH",
    "http://localhost:8080/v1/projects/demo-counseled/databases/(default)/documents/trackers/testfam", doc,
    headers={"Authorization": "Bearer owner"})
check("seed tracker doc in emulator", st == 200, body[:200])

# --- 1. discovery metadata ---
st, body, _ = http("GET", BASE + "/.well-known/oauth-authorization-server")
meta = json.loads(body)
check("discovery metadata served", st == 200 and "authorization_endpoint" in meta)

# --- 2. dynamic client registration ---
st, body, _ = http("POST", meta["registration_endpoint"], {
    "client_name": "Test Claude", "redirect_uris": ["http://localhost:9999/callback"],
    "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
    "token_endpoint_auth_method": "none",
})
client = json.loads(body)
check("dynamic client registration", st in (200, 201) and "client_id" in client, body[:300])

# --- 3. authorize -> login page with reqId ---
verifier = secrets.token_urlsafe(48)
challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
q = urllib.parse.urlencode({
    "response_type": "code", "client_id": client["client_id"],
    "redirect_uri": "http://localhost:9999/callback",
    "code_challenge": challenge, "code_challenge_method": "S256", "state": "xyz",
})
st, body, _ = http("GET", meta["authorization_endpoint"] + "?" + q)
m = re.search(r'"(authreq_[A-Za-z0-9_-]+)"', body)
check("authorize serves sign-in page with reqId", st == 200 and m is not None, body[:300])
req_id = m.group(1)

# --- 4. mint an emulator ID token and consent ---
st, body, _ = http("POST",
    "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
    {"email": EMAIL, "password": "testtest", "returnSecureToken": True})
id_token = json.loads(body)["idToken"]
check("auth emulator issued ID token", st == 200)

st, body, _ = http("POST", BASE + "/oauth/consent", {"reqId": req_id, "idToken": id_token})
consent = json.loads(body)
check("consent returns redirect with code", st == 200 and "code=" in consent.get("redirect", ""), body[:300])
code = urllib.parse.parse_qs(urllib.parse.urlparse(consent["redirect"]).query)["code"][0]

# --- 5. token exchange (PKCE) ---
st, body, _ = http("POST", meta["token_endpoint"], {
    "grant_type": "authorization_code", "code": code, "code_verifier": verifier,
    "client_id": client["client_id"], "redirect_uri": "http://localhost:9999/callback",
}, form=True)
tokens = json.loads(body)
check("token exchange", st == 200 and "access_token" in tokens, body[:300])
AT = tokens["access_token"]

# --- 6. MCP handshake + tools ---
def mcp(method, params=None, tid=1):
    st, body, _ = http("POST", BASE + "/mcp",
        {"jsonrpc": "2.0", "id": tid, "method": method, "params": params or {}},
        headers={"Authorization": "Bearer " + AT, "Accept": "application/json, text/event-stream"})
    # streamable http may answer as SSE; extract data lines
    if body.startswith("event:") or "\ndata:" in body or body.startswith("data:"):
        datas = [l[5:].strip() for l in body.splitlines() if l.startswith("data:")]
        body = datas[-1] if datas else body
    return st, json.loads(body) if body.strip() else {}

st, r = mcp("initialize", {"protocolVersion": "2025-06-18",
    "capabilities": {}, "clientInfo": {"name": "e2e", "version": "0"}})
check("MCP initialize", st == 200 and r.get("result", {}).get("serverInfo", {}).get("name") == "counseled", json.dumps(r)[:300])

st, r = mcp("tools/list", tid=2)
names = [t["name"] for t in r.get("result", {}).get("tools", [])]
check("tools/list shows 3 tools", set(names) == {"list_trackers", "get_tracker", "update_tracker"}, str(names))

st, r = mcp("tools/call", {"name": "list_trackers", "arguments": {}}, tid=3)
check("list_trackers finds seeded tracker", "testfam" in json.dumps(r), json.dumps(r)[:300])

st, r = mcp("tools/call", {"name": "get_tracker", "arguments": {"tracker_id": "testfam"}}, tid=4)
got = json.loads(r["result"]["content"][0]["text"])
check("get_tracker returns state", got["student"]["name"] == "Test Student")

# --- 7. update: legal merge ---
got["schools"].append({"name": "Added College", "tier": "conditional_target", "status": "researching",
    "coa": 60000, "merit_rate": 0.8, "avg_merit": 25000, "est_price": 35000, "npc_run": False,
    "npc_estimate": None, "deadlines": {}, "next_action": "", "notes": "added in e2e"})
st, r = mcp("tools/call", {"name": "update_tracker", "arguments":
    {"tracker_id": "testfam", "state": got, "session_note": "e2e added a school"}}, tid=5)
check("update_tracker accepts merge", "version 2" in json.dumps(r), json.dumps(r)[:300])

# --- 8. guardrail: deleting schools refused ---
bad = json.loads(json.dumps(got)); bad["schools"] = bad["schools"][:1]
st, r = mcp("tools/call", {"name": "update_tracker", "arguments":
    {"tracker_id": "testfam", "state": bad, "session_note": "bad"}}, tid=6)
check("guardrail refuses school deletion", "Refusing" in json.dumps(r), json.dumps(r)[:300])

# --- 9. scoping: stranger's token sees nothing ---
st, body, _ = http("POST",
    "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
    {"email": "stranger@example.com", "password": "testtest", "returnSecureToken": True})
stranger_token = json.loads(body)["idToken"]
q2 = urllib.parse.urlencode({"response_type": "code", "client_id": client["client_id"],
    "redirect_uri": "http://localhost:9999/callback", "code_challenge": challenge,
    "code_challenge_method": "S256"})
st, body, _ = http("GET", meta["authorization_endpoint"] + "?" + q2)
req2 = re.search(r'"(authreq_[A-Za-z0-9_-]+)"', body).group(1)
st, body, _ = http("POST", BASE + "/oauth/consent", {"reqId": req2, "idToken": stranger_token})
check("stranger denied at consent (no tracker access)", st == 403, body[:200])

print(f"\n{PASS} checks passed — full OAuth + MCP round trip works.")
