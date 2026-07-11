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
check("tools/list shows core + data tools", set(names) >= {"list_trackers", "get_tracker", "update_tracker", "create_tracker"} and "add_family_member" not in names, str(names))

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

# --- 9. new-user journey: token OK, scoped out, invite-gated creation ---
st, body, _ = http("POST",
    "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
    {"email": "stranger@example.com", "password": "testtest", "returnSecureToken": True})
stranger_id_token = json.loads(body)["idToken"]
q2 = urllib.parse.urlencode({"response_type": "code", "client_id": client["client_id"],
    "redirect_uri": "http://localhost:9999/callback", "code_challenge": challenge,
    "code_challenge_method": "S256"})
st, body, _ = http("GET", meta["authorization_endpoint"] + "?" + q2)
req2 = re.search(r'"(authreq_[A-Za-z0-9_-]+)"', body).group(1)
st, body, _ = http("POST", BASE + "/oauth/consent", {"reqId": req2, "idToken": stranger_id_token})
check("new user can authorize (no tracker yet)", st == 200 and "code=" in json.loads(body).get("redirect", ""), body[:200])
code2 = urllib.parse.parse_qs(urllib.parse.urlparse(json.loads(body)["redirect"]).query)["code"][0]
st, body, _ = http("POST", meta["token_endpoint"], {
    "grant_type": "authorization_code", "code": code2, "code_verifier": verifier,
    "client_id": client["client_id"], "redirect_uri": "http://localhost:9999/callback"}, form=True)
AT2 = json.loads(body)["access_token"]
def mcp2(method, params=None, tid=1):
    st, body, _ = http("POST", BASE + "/mcp",
        {"jsonrpc": "2.0", "id": tid, "method": method, "params": params or {}},
        headers={"Authorization": "Bearer " + AT2, "Accept": "application/json, text/event-stream"})
    if body.startswith("event:") or "\ndata:" in body or body.startswith("data:"):
        datas = [l[5:].strip() for l in body.splitlines() if l.startswith("data:")]
        body = datas[-1] if datas else body
    return st, json.loads(body) if body.strip() else {}
mcp2("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e2", "version": "0"}})
st, r = mcp2("tools/call", {"name": "get_tracker", "arguments": {"tracker_id": "testfam"}}, tid=11)
check("stranger cannot read another family's tracker", "No tracker" in json.dumps(r), json.dumps(r)[:200])
st, r = mcp2("tools/call", {"name": "create_tracker", "arguments":
    {"invite_code": "bogus-code", "student_name": "New Kid", "grad_year": 2028}}, tid=12)
check("bogus invite code refused", "invalid invite code" in json.dumps(r), json.dumps(r)[:200])
inv = {"fields": {"created": fs_value("2026-07-10"), "expires": fs_value(9999999999999),
                  "note": fs_value("e2e"), "used_by": fs_value(None)}}
st, body, _ = http("PATCH",
    "http://localhost:8080/v1/projects/demo-counseled/databases/(default)/documents/invite_codes/counseled-test-code",
    inv, headers={"Authorization": "Bearer owner"})
check("seed invite code", st == 200, body[:200])
st, r = mcp2("tools/call", {"name": "create_tracker", "arguments":
    {"invite_code": "counseled-test-code", "student_name": "New Kid", "grad_year": 2028}}, tid=13)
check("create_tracker with valid invite", "Created tracker" in json.dumps(r), json.dumps(r)[:300])
# after redeeming a code the user holds an entitlement, so a second create
# succeeds WITHOUT a code — the code itself must be dead for anyone else
st, body, _ = http("POST",
    "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
    {"email": "third@example.com", "password": "testtest", "returnSecureToken": True})
third_id_token = json.loads(body)["idToken"]
q3 = urllib.parse.urlencode({"response_type": "code", "client_id": client["client_id"],
    "redirect_uri": "http://localhost:9999/callback", "code_challenge": challenge,
    "code_challenge_method": "S256"})
st, body, _ = http("GET", meta["authorization_endpoint"] + "?" + q3)
req3 = re.search(r'"(authreq_[A-Za-z0-9_-]+)"', body).group(1)
st, body, _ = http("POST", BASE + "/oauth/consent", {"reqId": req3, "idToken": third_id_token})
code3 = urllib.parse.parse_qs(urllib.parse.urlparse(json.loads(body)["redirect"]).query)["code"][0]
st, body, _ = http("POST", meta["token_endpoint"], {
    "grant_type": "authorization_code", "code": code3, "code_verifier": verifier,
    "client_id": client["client_id"], "redirect_uri": "http://localhost:9999/callback"}, form=True)
AT3 = json.loads(body)["access_token"]
def mcp3(method, params=None, tid=1):
    st, body, _ = http("POST", BASE + "/mcp",
        {"jsonrpc": "2.0", "id": tid, "method": method, "params": params or {}},
        headers={"Authorization": "Bearer " + AT3, "Accept": "application/json, text/event-stream"})
    if body.startswith("event:") or "\ndata:" in body or body.startswith("data:"):
        datas = [l[5:].strip() for l in body.splitlines() if l.startswith("data:")]
        body = datas[-1] if datas else body
    return st, json.loads(body) if body.strip() else {}
mcp3("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e3", "version": "0"}})
st, r = mcp3("tools/call", {"name": "create_tracker", "arguments":
    {"invite_code": "counseled-test-code", "student_name": "Sneaky Third", "grad_year": 2028}}, tid=31)
check("used invite code is dead for other users", "already used" in json.dumps(r), json.dumps(r)[:200])
st, r = mcp2("tools/call", {"name": "list_trackers", "arguments": {}}, tid=15)
check("new tracker visible to its creator", "new-kid" in json.dumps(r), json.dumps(r)[:300])

print(f"\n{PASS} checks passed — OAuth, MCP, guardrails, and onboarding all work.")

# --- 10. entitlements: second tracker, family add, lapse -> read-only ---
st, r = mcp2("tools/call", {"name": "create_tracker", "arguments":
    {"student_name": "Second Kid", "grad_year": 2030}}, tid=16)
check("entitled user creates 2nd tracker without code", "Created tracker" in json.dumps(r), json.dumps(r)[:300])

st, r = mcp2("tools/call", {"name": "list_trackers", "arguments": {}}, tid=17)
newkid_id = [t["tracker_id"] for t in json.loads(r["result"]["content"][0]["text"]) if t["tracker_id"].startswith("new-kid")][0]
# family adds are page-only (no tool by design); emulate the page's write via
# admin REST, then confirm the added member sees the tracker through the API
import urllib.request as _u
patch_url = ("http://localhost:8080/v1/projects/demo-counseled/databases/(default)/documents/trackers/"
             + newkid_id + "?updateMask.fieldPaths=allowed_emails")
body2 = {"fields": {"allowed_emails": fs_value(["stranger@example.com", EMAIL])}}
st, body, _ = http("PATCH", patch_url, body2, headers={"Authorization": "Bearer owner"})
check("page-style family add (admin emulation)", st == 200, body[:200])
st, r = mcp("tools/call", {"name": "list_trackers", "arguments": {}}, tid=19)
check("added member sees the shared tracker", newkid_id in json.dumps(r), json.dumps(r)[:300])

# lapse the stranger's entitlement, then writes are refused but reads work
lapse = {"fields": {"status": fs_value("lapsed"), "source": fs_value("invite")}}
st, body, _ = http("PATCH",
    "http://localhost:8080/v1/projects/demo-counseled/databases/(default)/documents/entitlements/stranger%40example.com",
    lapse, headers={"Authorization": "Bearer owner"})
check("lapse entitlement", st == 200, body[:200])

st, r = mcp2("tools/call", {"name": "get_tracker", "arguments": {"tracker_id": newkid_id}}, tid=20)
lapsed_state = json.loads(r["result"]["content"][0]["text"])
check("lapsed family can still READ", lapsed_state["student"]["name"] == "New Kid")
st, r = mcp2("tools/call", {"name": "update_tracker", "arguments":
    {"tracker_id": newkid_id, "state": lapsed_state, "session_note": "should fail"}}, tid=21)
check("lapsed family cannot WRITE (read-only message)", "read-only" in json.dumps(r), json.dumps(r)[:300])
st, r = mcp2("tools/call", {"name": "create_tracker", "arguments":
    {"student_name": "Third Kid", "grad_year": 2031}}, tid=22)
check("lapsed user cannot create new tracker", "lapsed" in json.dumps(r), json.dumps(r)[:300])

print(f"\n{PASS} checks passed total.")

# --- 11. connector-only experience: data + playbook tools ---
st, r = mcp("tools/list", tid=40)
names = [t["name"] for t in r.get("result", {}).get("tools", [])]
check("data tools present (8 total)", set(names) >= {"get_playbook", "search_colleges", "get_college"}, str(names))
st, r = mcp("tools/call", {"name": "get_playbook", "arguments": {}}, tid=41)
check("playbook served", "money tier" in json.dumps(r).lower() or "conditional target" in json.dumps(r).lower(), json.dumps(r)[:200])
st, r = mcp("tools/call", {"name": "search_colleges", "arguments":
    {"budget": 40000, "sat": 1550, "gpa": 3.95, "home_state": "NJ"}}, tid=42)
body = json.loads(r["result"]["content"][0]["text"])
check("search_colleges classifies the dataset", body["summary"].get("conditional_target", 0) > 10, str(body["summary"]))
st, r = mcp("tools/call", {"name": "get_college", "arguments": {"name": "Tulane"}}, tid=43)
check("get_college fuzzy lookup", "Tulane University" in json.dumps(r), json.dumps(r)[:200])

print(f"\n{PASS} checks passed grand total.")

# --- 12. admin-only minting ---
st, r = mcp("tools/list", tid=50)
names = [t["name"] for t in r.get("result", {}).get("tools", [])]
check("non-admin does NOT see mint_invite", "mint_invite" not in names, str(names))
adm = {"fields": {"email": fs_value(EMAIL)}}
st, body, _ = http("PATCH",
    "http://localhost:8080/v1/projects/demo-counseled/databases/(default)/documents/admin_users/" + EMAIL.replace("@", "%40"),
    adm, headers={"Authorization": "Bearer owner"})
check("seed admin_users doc", st == 200, body[:200])
st, r = mcp("tools/list", tid=51)
names = [t["name"] for t in r.get("result", {}).get("tools", [])]
check("admin sees mint_invite", "mint_invite" in names, str(names))
st, r = mcp("tools/call", {"name": "mint_invite", "arguments": {"count": 2, "days": 14, "note": "e2e"}}, tid=52)
minted = re.findall(r"counseled-[0-9a-f]{4}-[0-9a-f]{4}", json.dumps(r))
check("admin mints 2 codes", len(set(minted)) == 2, json.dumps(r)[:300])

print(f"\n{PASS} checks passed FINAL total.")

# --- 13. capability discovery: server instructions + public data API ---
st, r = mcp("initialize", {"protocolVersion": "2025-06-18",
    "capabilities": {}, "clientInfo": {"name": "e2e4", "version": "0"}}, tid=60)
instr = r.get("result", {}).get("instructions", "")
check("initialize carries capability instructions", "Counseled" in instr and "get_playbook" in instr, instr[:200])
st, body, hdrs = http("GET", BASE + "/api/college?name=Tulane", headers={"Origin": "https://counseled.app"})
check("public /api/college serves data", st == 200 and "Tulane University" in body, body[:200])
check("CORS header for counseled.app", hdrs.get("Access-Control-Allow-Origin") == "https://counseled.app", str(hdrs)[:200])
st, body, _ = http("GET", BASE + "/api/college?name=Hogwarts")
check("unknown school 404s cleanly", st == 404, body[:200])

print(f"\n{PASS} checks passed GRAND FINAL total.")

# --- 14. freeform pages: create, sandbox-serve, lint, iterate ---
PAGE_HTML = "<style>h1{color:#1e5b4f}</style><h1>Cost matrix</h1><script>Counseled.ready(s => { document.querySelector('h1').textContent = s.student.name + ' has ' + s.schools.length + ' schools'; });</script>"
st, r = mcp("tools/call", {"name": "create_page", "arguments":
    {"tracker_id": "testfam", "title": "Cost matrix", "html": PAGE_HTML}}, tid=70)
body_txt = json.dumps(r)
check("create_page succeeds", "page_id pg_" in body_txt, body_txt[:300])
page_id = re.search(r"pg_[A-Za-z0-9_-]+", body_txt).group(0)

st, body, hdrs = http("GET", BASE + "/p/" + page_id)
check("page served with strict CSP", st == 200 and "connect-src 'none'" in hdrs.get("Content-Security-Policy", ""), str(hdrs)[:300])
check("page wraps bootstrap + content", "counseled-ready" in body and "Cost matrix" in body, body[:200])
check("frame-ancestors pins counseled.app", "frame-ancestors https://counseled.app" in hdrs.get("Content-Security-Policy", ""))

st, r = mcp("tools/call", {"name": "create_page", "arguments":
    {"tracker_id": "testfam", "title": "Evil", "html": "<iframe src='https://evil.example'></iframe>"}}, tid=71)
check("iframe in page rejected at creation", "forbidden construct" in json.dumps(r), json.dumps(r)[:200])

st, r = mcp("tools/call", {"name": "update_page", "arguments":
    {"page_id": page_id, "html": PAGE_HTML + "<p>v2</p>", "session_note": "e2e iterate"}}, tid=72)
check("update_page bumps version", "v2" in json.dumps(r), json.dumps(r)[:200])
st, r = mcp("tools/call", {"name": "list_pages", "arguments": {"tracker_id": "testfam"}}, tid=73)
check("list_pages shows the page", "Cost matrix" in json.dumps(r), json.dumps(r)[:200])
st, r = mcp2("tools/call", {"name": "get_page", "arguments": {"page_id": page_id}}, tid=74)
check("other family's member cannot read the page", "not accessible" in json.dumps(r), json.dumps(r)[:200])
st, body, _ = http("GET", BASE + "/p/pg_doesnotexist")
check("unknown page 404s", st == 404)

print(f"\n{PASS} checks passed ABSOLUTE FINAL total.")
