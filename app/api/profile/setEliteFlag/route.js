import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { ensureServerUser } from "../../../../lib/serverEnsureUser";
import { requireUidFromRequest } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

/**
 * Только для разработки: выставить premium.isElite без Stripe.
 * На проде выключено (нет ELITE_DEV_TOGGLE=true).
 */
export async function POST(req) {
  if (process.env.ELITE_DEV_TOGGLE !== "true") {
    return Response.json({ error: "elite_dev_toggle_disabled" }, { status: 403 });
  }

  try {
    const uid = await requireUidFromRequest(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }
    const elite = Boolean(body.elite);

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

    await ensureServerUser(uid);

    await db.collection("users").doc(uid).update({
      "premium.isElite": elite,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, isElite: elite });
  } catch (e) {
    if (e?.message === "Unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("setEliteFlag:", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
