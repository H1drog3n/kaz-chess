import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { requireUidFromRequest } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

function isFirebaseAdminConfigError(message) {
  const m = String(message || "");
  return (
    m.includes("Missing Firebase Admin credentials") ||
    m.includes("FIREBASE_SERVICE_ACCOUNT_JSON_FILE points to missing") ||
    m.includes("Invalid Firebase Admin JSON") ||
    m.includes("FIREBASE_SERVICE_ACCOUNT_JSON")
  );
}

function classifyStripeCheckoutError(e) {
  const msg = String(e?.message || "");
  const lower = msg.toLowerCase();
  if (e?.code === "resource_missing") return "stripe_invalid_price";
  if (/no such price|unknown price|invalid price|price.*does not exist/i.test(lower)) {
    return "stripe_invalid_price";
  }
  const typ = String(e?.type || e?.raw?.type || "");
  if (typ.includes("Stripe")) return "stripe_api_error";
  if (lower.includes("stripe")) return "stripe_api_error";
  return null;
}

export async function POST(req) {
  try {
    const uid = await requireUidFromRequest(req);

    const secret = process.env.STRIPE_SECRET_KEY;
    const price = process.env.STRIPE_ELITE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!secret || !price) {
      return Response.json({ error: "stripe_not_configured" }, { status: 500 });
    }

    const stripe = new Stripe(secret);

    let db;
    try {
      db = getAdminDb();
    } catch (e) {
      if (String(e?.message || "").includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
        return Response.json(
          { error: "firebase_admin_not_configured" },
          { status: 500 }
        );
      }
      throw e;
    }
    const userSnap = await db.collection("users").doc(uid).get();
    const email = userSnap.exists ? userSnap.data()?.email || "" : "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email || undefined,
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/profile?elite=1`,
      cancel_url: `${appUrl}/profile?elite=0`,
      metadata: { uid },
      subscription_data: {
        metadata: { uid },
      },
    });

    await db.collection("users").doc(uid).set(
      {
        premium: {
          stripeCheckoutSessionId: session.id,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ url: session.url });
  } catch (e) {
    if (e?.message === "Unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (isFirebaseAdminConfigError(e?.message)) {
      return Response.json(
        { error: "firebase_admin_not_configured" },
        { status: 500 }
      );
    }

    const stripeCode = classifyStripeCheckoutError(e);
    const devDetail =
      process.env.NODE_ENV !== "production"
        ? String(e?.message || e)
        : undefined;

    if (stripeCode) {
      return Response.json(
        { error: stripeCode, detail: devDetail },
        { status: 400 }
      );
    }

    console.error("create-checkout-session:", e);
    return Response.json(
      {
        error: "server_error",
        ...(devDetail ? { detail: devDetail } : {}),
      },
      { status: 500 }
    );
  }
}
