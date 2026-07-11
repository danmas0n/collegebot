/**
 * Stripe billing for counseled.app family subscriptions.
 *
 * Env (all three required to enable billing; otherwise /join runs in
 * invite-only mode and says so):
 *   STRIPE_SECRET_KEY      sk_live_... (or sk_test_...)
 *   STRIPE_PRICE_ID        price for the yearly family subscription
 *   STRIPE_WEBHOOK_SECRET  from the dashboard webhook endpoint pointing at
 *                          <PUBLIC_URL>/stripe/webhook
 *
 * Flow: /join (pitch page) -> POST /join/checkout -> Stripe Checkout ->
 * GET /join/success?session_id=... verifies the session server-side, writes
 * an active entitlement for the checkout email, and shows setup steps.
 * Webhooks keep the entitlement in sync afterwards (lapse on cancellation or
 * final payment failure, reactivate on recovery).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { setEntitlement, entitlementByStripeCustomer } from "./entitlements.js";

const KEY = process.env.STRIPE_SECRET_KEY;
const PRICE = process.env.STRIPE_PRICE_ID;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:8787";

const stripe = KEY ? new Stripe(KEY) : null;
export const billingEnabled = Boolean(stripe && PRICE && WEBHOOK_SECRET);

export function mountBilling(app: Express) {
  // Raw body BEFORE express.json for signature verification — mount early.
  app.post("/stripe/webhook", express.raw({ type: "application/json" }), handleWebhook);

  app.get("/join", (_req, res) => res.type("html").send(joinPage()));

  app.post("/join/checkout", async (_req, res) => {
    if (!stripe || !PRICE) return res.status(503).json({ error: "billing not configured — invite-only for now" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${PUBLIC_URL}/join/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/join`,
    });
    res.redirect(303, session.url!);
  });

  app.get("/join/success", async (req, res) => {
    if (!stripe) return res.status(503).send("billing not configured");
    try {
      const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return res.status(402).send("Checkout not completed. Return to /join and try again.");
      }
      const email = session.customer_details?.email;
      if (!email) return res.status(500).send("No email on checkout session — contact support.");
      await setEntitlement(email, {
        status: "active",
        source: "stripe",
        stripe_customer_id: String(session.customer),
        stripe_subscription_id: String(session.subscription),
      });
      res.type("html").send(successPage(email));
    } catch (e: any) {
      res.status(400).send("Could not verify checkout session: " + e.message);
    }
  });
}

async function handleWebhook(req: Request, res: Response) {
  if (!stripe || !WEBHOOK_SECRET) return res.status(503).end();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, WEBHOOK_SECRET);
  } catch (e: any) {
    return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
  }

  const sub = event.data.object as Stripe.Subscription;
  const findEnt = async () => entitlementByStripeCustomer(String(sub.customer));

  switch (event.type) {
    case "customer.subscription.deleted": {
      const ent = await findEnt();
      if (ent) await setEntitlement(ent.email, { status: "lapsed" });
      break;
    }
    case "customer.subscription.updated": {
      const ent = await findEnt();
      if (ent) {
        const active = sub.status === "active" || sub.status === "trialing";
        await setEntitlement(ent.email, { status: active ? "active" : "lapsed" });
      }
      break;
    }
    default:
      break; // ignore everything else
  }
  res.json({ received: true });
}

function joinPage(): string {
  const checkout = billingEnabled
    ? `<form method="POST" action="/join/checkout"><button class="primary">Get started — $39/year</button></form>`
    : `<p class="muted">Sign-ups are currently invite-only. Have an invite code? Skip to step 2 below and give Claude your code.</p>`;
  return page("Counseled — your family's college money HQ", `
    <h1>Counseled</h1>
    <p>Your family's college search, in one live page your own Claude can read
    and update: which schools actually give merit aid to families like yours,
    what each really costs, deadlines, to-dos, and a journal — synced for the
    whole family.</p>
    <p><b>Bring your own Claude</b> (free or paid claude.ai account). Counseled
    provides the data, the method, and the shared family page.</p>
    ${checkout}
    <h2>Set up (5 minutes)</h2>
    <ol>
      <li>Download the <a href="https://counseled.app/counseled-skill.zip">college-money-finder skill</a> and upload it in Claude: Settings → Capabilities → Skills.</li>
      <li>Add the Counseled connector in Claude: Settings → Connectors → Add custom connector → <code>${PUBLIC_URL}/mcp</code> — sign in with Google when asked.</li>
      <li>Tell Claude: <i>"Set up our college tracker"</i> — it will use your invite code or subscription and interview you from there.</li>
    </ol>
    <p class="muted">Cancel anytime; your tracker stays readable and exportable forever.</p>`);
}

function successPage(email: string): string {
  return page("Welcome to Counseled", `
    <h1>You're in 🎉</h1>
    <p>Subscription active for <b>${email.replace(/[<>&"]/g, "")}</b>. Two steps left:</p>
    <ol>
      <li>Download the <a href="https://counseled.app/counseled-skill.zip">college-money-finder skill</a> and upload it in Claude: Settings → Capabilities → Skills.</li>
      <li>Add the connector: Settings → Connectors → Add custom connector → <code>${PUBLIC_URL}/mcp</code> — sign in with <b>the same Google account you used at checkout</b>.</li>
    </ol>
    <p>Then tell Claude: <i>"Set up our college tracker."</i></p>`);
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
  body { font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif; background: #f6f7f5; color: #22302c; margin: 0; padding: 24px 16px; }
  .card { max-width: 560px; margin: 6vh auto; background: #fff; border: 1px solid #e2e6e3; border-radius: 8px; padding: 32px; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, serif; margin: 0 0 10px; }
  h2 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-size: 1.05rem; margin: 22px 0 6px; }
  p, li { font-size: .95rem; line-height: 1.5; }
  .muted { color: #66756e; font-size: .85rem; }
  button.primary { font: inherit; padding: 10px 18px; border-radius: 6px; border: none; background: #1e5b4f; color: #fff; cursor: pointer; }
  code { background: #eef1ef; padding: 2px 6px; border-radius: 4px; font-size: .85em; word-break: break-all; }
</style></head><body><div class="card">${body}</div></body></html>`;
}
