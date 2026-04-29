import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { getAdminDb } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return new Response("stripe_not_configured", { status: 500 });
  }

  const stripe = new Stripe(secret);

  const sig = req.headers.get("stripe-signature");
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (e) {
    return new Response(`Webhook Error: ${e.message}`, { status: 400 });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (e) {
    if (String(e?.message || "").includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
      return new Response("firebase_admin_not_configured", { status: 500 });
    }
    throw e;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const uid = session?.metadata?.uid;
        const subId = session?.subscription;
        const customerId = session?.customer;
        if (uid) {
          await db.collection("users").doc(String(uid)).set(
            {
              premium: {
                isElite: true,
                stripeCustomerId: customerId ? String(customerId) : "",
                stripeSubscriptionId: subId ? String(subId) : "",
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const uid = sub?.metadata?.uid;
        const status = String(sub?.status || "");
        const active = status === "active" || status === "trialing";
        if (uid) {
          await db.collection("users").doc(String(uid)).set(
            {
              premium: {
                isElite: active,
                stripeSubscriptionId: String(sub.id || ""),
                stripeCustomerId: String(sub.customer || ""),
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(e);
    return new Response("handler_error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
