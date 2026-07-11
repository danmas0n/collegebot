/**
 * Entitlements: who may create trackers and whose trackers accept writes.
 *
 * entitlements/{email}: {
 *   status: "active" | "lapsed",
 *   source: "invite" | "stripe" | "founder",
 *   stripe_customer_id?, stripe_subscription_id?, created, updated
 * }
 *
 * Rules:
 * - create_tracker needs a valid invite code OR an active entitlement.
 * - Writes to a tracker require the tracker OWNER's entitlement to be active
 *   (family members ride on the owner's subscription). Reads always work —
 *   lapsed families keep full read access to their own data.
 * - Trackers created before entitlements existed (no owner_email field) are
 *   grandfathered as founder trackers.
 */
import { db } from "./firestore.js";

const today = () => new Date().toISOString().slice(0, 10);

export async function getEntitlement(email: string) {
  const doc = await db.collection("entitlements").doc(email.toLowerCase()).get();
  return doc.exists ? (doc.data() as { status: string; source: string }) : null;
}

export async function setEntitlement(
  email: string,
  fields: { status: "active" | "lapsed"; source?: string; stripe_customer_id?: string; stripe_subscription_id?: string }
) {
  const ref = db.collection("entitlements").doc(email.toLowerCase());
  const exists = (await ref.get()).exists;
  await ref.set(
    { ...fields, updated: today(), ...(exists ? {} : { created: today() }) },
    { merge: true }
  );
}

export async function entitlementByStripeCustomer(customerId: string) {
  const snap = await db.collection("entitlements").where("stripe_customer_id", "==", customerId).limit(1).get();
  return snap.empty ? null : { email: snap.docs[0].id, ref: snap.docs[0].ref, ...snap.docs[0].data() };
}

/** May this tracker accept writes? (owner's entitlement governs) */
export async function writesAllowed(tracker: { owner_email?: string }): Promise<{ ok: boolean; why?: string }> {
  const owner = tracker.owner_email;
  if (!owner) return { ok: true }; // grandfathered founder tracker
  const ent = await getEntitlement(owner);
  if (ent?.status === "active") return { ok: true };
  return {
    ok: false,
    why:
      `This tracker is read-only because the family's counseled.app subscription (owner ${owner}) is not active. ` +
      `All data remains readable and exportable. Renew at https://counseled.app/join to re-enable updates.`,
  };
}
