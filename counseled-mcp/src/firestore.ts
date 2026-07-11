import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "collegebot-dev-52f43";

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

export const db: Firestore = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const auth: Auth = getAuth(app);
export { FieldValue, PROJECT_ID };

// Collections:
//   trackers/{id}            { allowed_emails: string[], state: {...} }
//   oauth_clients/{clientId}  registered connector clients (claude.ai, Claude Code)
//   oauth_requests/{reqId}    pending authorizations awaiting Google sign-in
//   oauth_codes/{code}        issued authorization codes (short-lived)
//   oauth_tokens/{token}      access + refresh tokens

export async function trackersForEmail(email: string) {
  const snap = await db.collection("trackers").where("allowed_emails", "array-contains", email).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as { allowed_emails: string[]; state: any }) }));
}

export async function trackerForEmail(email: string, trackerId: string) {
  const doc = await db.collection("trackers").doc(trackerId).get();
  if (!doc.exists) return null;
  const data = doc.data() as { allowed_emails: string[]; state: any };
  if (!data.allowed_emails?.includes(email)) return null;
  return { ref: doc.ref, ...data };
}
