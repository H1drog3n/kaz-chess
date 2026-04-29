import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { PIECE_SETS } from "../../../../lib/pieceSets";
import { requireUidFromRequest } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = await req.json();
    const setId = String(body.setId || "");

    const setDef = PIECE_SETS[setId];
    if (!setDef) return Response.json({ error: "invalid_set" }, { status: 400 });

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
    const userRef = db.collection("users").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("no_user");

      const data = snap.data() || {};
      const unlocked = new Set(data?.cosmetics?.unlockedPieceSets || ["classic"]);
      if (unlocked.has(setId)) {
        return { alreadyOwned: true };
      }

      const price = Number(setDef.priceCoins || 0);
      const coins = Number(data?.economy?.coins || 0);
      if (coins < price) {
        const err = new Error("not_enough_coins");
        err.code = "not_enough_coins";
        throw err;
      }

      unlocked.add(setId);
      tx.update(userRef, {
        "economy.coins": coins - price,
        "cosmetics.unlockedPieceSets": Array.from(unlocked),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { alreadyOwned: false, newBalance: coins - price };
    });

    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e?.message === "Unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (e?.code === "not_enough_coins") {
      return Response.json({ error: "not_enough_coins" }, { status: 402 });
    }
    console.error(e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
