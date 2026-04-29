import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { QUIZ_BASICS_1 } from "../../../../lib/learn/quizBasics1";
import { DEFAULT_ELO } from "../../../../lib/elo";
import { ensureServerUser } from "../../../../lib/serverEnsureUser";
import { repairEconomyProgressShape } from "../../../../lib/serverRepairUserEconomy";
import { levelFromXp } from "../../../../lib/xp";
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

/** Отключённый Cloud Firestore API в GCP / база не создана — типичная ошибка при первом деплое. */
function isFirestoreApiDisabledError(e) {
  const msg = String(e?.message || "");
  return (
    msg.includes("Cloud Firestore API has not been used") ||
    (msg.includes("PERMISSION_DENIED") && msg.includes("firestore.googleapis.com"))
  );
}

export async function POST(req) {
  try {
    const uid = await requireUidFromRequest(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }
    const quizId = String(body.quizId || "");
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

    if (!quizId) return Response.json({ error: "invalid_payload" }, { status: 400 });

    let db;
    try {
      db = getAdminDb();
    } catch (e) {
      if (isFirebaseAdminConfigError(e?.message)) {
        return Response.json(
          { error: "firebase_admin_not_configured" },
          { status: 500 }
        );
      }
      throw e;
    }

    await ensureServerUser(uid);
    await repairEconomyProgressShape(uid);

    const quizRef = db.collection("quizzes").doc(quizId);
    const quizSnap = await quizRef.get();

    /** @type {{ rewardCoins?: number; rewardXp?: number } | null} */
    let quiz = null;
    /** @type {Array<{ id: string; correctOptionId?: string }>} */
    let questions = [];

    if (quizSnap.exists) {
      quiz = quizSnap.data() || {};
      if (!quiz.isPublished) return Response.json({ error: "not_found" }, { status: 404 });
      const qSnap = await quizRef.collection("questions").get();
      questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else if (quizId === QUIZ_BASICS_1.id) {
      // Демо без документа квиза в Firestore — те же вопросы и награды, что при сиде.
      quiz = {
        rewardCoins: QUIZ_BASICS_1.rewardCoins,
        rewardXp: QUIZ_BASICS_1.rewardXp,
      };
      questions = QUIZ_BASICS_1.questions.map((q) => ({ ...q }));
    } else {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    let score = 0;
    const maxScore = questions.length;

    for (const q of questions) {
      const selected = String(answers[q.id] ?? "");
      if (selected && selected === String(q.correctOptionId)) score += 1;
    }

    const ratio = maxScore ? score / maxScore : 0;
    const rewardCoins = Math.round(Number(quiz.rewardCoins || 0) * ratio);
    const rewardXp = Math.round(Number(quiz.rewardXp || 0) * ratio);

    function safeNonNegInt(n) {
      const x = Number(n);
      if (!Number.isFinite(x) || x < 0) return 0;
      return Math.round(x);
    }

    const userRef = db.collection("users").doc(uid);
    const publicRef = db.collection("publicUsers").doc(uid);
    const attemptRef = userRef.collection("quizAttempts").doc();

    let result;

    await db.runTransaction(async (tx) => {
      const u = await tx.get(userRef);
      if (!u.exists) throw new Error("no_user");

      const data = u.data() || {};
      const coins0 = safeNonNegInt(data?.economy?.coins);
      const xp0 = safeNonNegInt(data?.progress?.xp);

      const coins1 = coins0 + rewardCoins;
      const xp1 = xp0 + rewardXp;
      const lvl1 = levelFromXp(xp1);
      let eloPub = DEFAULT_ELO;
      const rawElo = data.elo;
      if (typeof rawElo === "number" && Number.isFinite(rawElo)) eloPub = rawElo;
      else if (typeof rawElo === "string" && rawElo.trim()) {
        const n = Number(rawElo);
        if (Number.isFinite(n)) eloPub = n;
      }

      tx.set(
        userRef,
        {
          economy: { coins: coins1 },
          progress: { xp: xp1, level: lvl1 },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        publicRef,
        {
          userId: uid,
          username: data.username || "player",
          elo: eloPub,
          xp: xp1,
          level: lvl1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(attemptRef, {
        quizId,
        score,
        maxScore,
        earnedCoins: rewardCoins,
        earnedXp: rewardXp,
        createdAt: FieldValue.serverTimestamp(),
      });

      result = {
        score,
        maxScore,
        earnedCoins: rewardCoins,
        earnedXp: rewardXp,
        balances: { coins: coins1, xp: xp1, level: lvl1 },
      };
    });

    return Response.json({ ok: true, ...result });
  } catch (e) {
    if (e?.message === "Unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (e?.message === "no_user") {
      return Response.json({ error: "profile_missing" }, { status: 400 });
    }
    if (isFirebaseAdminConfigError(e?.message)) {
      return Response.json(
        { error: "firebase_admin_not_configured" },
        { status: 500 }
      );
    }
    if (isFirestoreApiDisabledError(e)) {
      return Response.json({ error: "firestore_api_disabled" }, { status: 503 });
    }
    console.error("submitQuiz:", e?.code || "", e?.message || e);
    const isProd = process.env.NODE_ENV === "production";
    return Response.json(
      {
        error: "server_error",
        ...(isProd
          ? {}
          : { detail: String(e?.message || ""), code: String(e?.code || "") }),
      },
      { status: 500 }
    );
  }
}
