import { FieldValue, Timestamp } from "firebase-admin/firestore";
import OpenAI from "openai";
import {
  classifyMoveFromMoverGain,
  evalToWhiteCp,
  moverLossCp,
} from "../../../../lib/coachEngine";
import { FREE_MONTHLY_ANALYSIS_LIMIT } from "../../../../lib/economyConstants";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { requireUidFromRequest } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

function monthStart(ts) {
  const d = ts.toDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

const GPT_CHUNK_SIZE = 22;

function fallbackGptComment(locale, label, san) {
  const s = String(san || "?");
  if (locale === "ru") {
    switch (label) {
      case "brilliant":
        return `Сильный ход ${s}: по оценке движка позиция заметно улучшилась.`;
      case "good":
        return `Спокойный ход ${s}: без серьёзных потерь по оценке.`;
      case "inaccuracy":
        return `Неточность ${s}: можно было сыграть точнее.`;
      case "mistake":
        return `Ошибка ${s}: позиция заметно ослабла.`;
      case "blunder":
        return `Зевок ${s}: резкое ухудшение позиции.`;
      default:
        return `Ход ${s}: оценка основана на движке; см. метку выше.`;
    }
  }
  switch (label) {
    case "brilliant":
      return `Strong move ${s}: the evaluation improves clearly.`;
    case "good":
      return `Solid move ${s}: no major evaluation swing.`;
    case "inaccuracy":
      return `Inaccuracy ${s}: there were more precise options.`;
    case "mistake":
      return `Mistake ${s}: the position worsens noticeably.`;
    case "blunder":
      return `Blunder ${s}: a serious evaluation drop.`;
    default:
      return `Move ${s}: engine-based assessment (see label above).`;
  }
}

async function explainMovesWithGpt({ locale, moves }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const suffix =
      locale === "ru"
        ? " (GPT не настроен — добавь OPENAI_API_KEY для живых текстов.)"
        : " (GPT not configured — add OPENAI_API_KEY for richer text.)";
    return moves.map((m) => ({
      ...m,
      gptComment: fallbackGptComment(locale, m.label, m.san) + suffix,
    }));
  }

  const client = new OpenAI({ apiKey });

  const system =
    locale === "ru"
      ? "Ты шахматный тренер. Для каждого хода из запроса напиши короткий комментарий на русском (1–2 предложения). Учитывай метку brilliant/good/inaccuracy/mistake/blunder и числовые поля оценки."
      : "You are a chess coach. For each move in the request, write a short comment (1–2 sentences) in English. Use labels brilliant/good/inaccuracy/mistake/blunder and the numeric evaluation fields.";

  const byIdx = new Map();

  for (let start = 0; start < moves.length; start += GPT_CHUNK_SIZE) {
    const slice = moves.slice(start, start + GPT_CHUNK_SIZE);
    const payload = slice.map((m) => ({
      index: m.index,
      san: m.san,
      mover: m.mover,
      label: m.label,
      cpBefore: m.cpBefore,
      cpAfter: m.cpAfter,
      moverGainCp: m.moverGainCp,
    }));

    const user = JSON.stringify({ moves: payload });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Return JSON ONLY: {comments:[{index:number, comment:string}]} — one comment per move index from this chunk. Indices must match exactly. No markdown.",
        },
        { role: "user", content: user },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { comments: [] };
    }

    for (const c of parsed.comments || []) {
      const idx = Number(c.index);
      const comment = String(c.comment || "").trim();
      if (comment) byIdx.set(idx, comment);
    }
  }

  return moves.map((m) => ({
    ...m,
    gptComment:
      byIdx.get(m.index) || fallbackGptComment(locale, m.label, m.san),
  }));
}

export async function POST(req) {
  try {
    const uid = await requireUidFromRequest(req);
    const body = await req.json();
    const gameId = String(body.gameId || "");
    const movesSan = Array.isArray(body.movesSan) ? body.movesSan.map(String) : [];
    const evals = Array.isArray(body.evals) ? body.evals : [];
    const engineDepth = Number(body.engineDepth || 12) || 12;
    const locale = body.locale === "en" ? "en" : "ru";

    if (!gameId || !movesSan.length || evals.length !== movesSan.length + 1) {
      return Response.json({ error: "invalid_payload" }, { status: 400 });
    }

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

    const analysisRef = userRef.collection("analyses").doc(gameId);
    const existing = await analysisRef.get();
    if (existing.exists) {
      return Response.json({ ok: true, cached: true, analysis: existing.data() });
    }

    // Build coach rows
    const rows = [];
    for (let i = 0; i < movesSan.length; i++) {
      const san = movesSan[i];
      const mover = i % 2 === 0 ? "w" : "b";
      const evBefore = evals[i];
      const evAfter = evals[i + 1];
      const loss = moverLossCp(evBefore, evAfter, mover);
      const label = classifyMoveFromMoverGain(-loss);

      rows.push({
        index: i,
        san,
        mover,
        label,
        evBefore,
        evAfter,
        cpBefore: evalToWhiteCp(evBefore),
        cpAfter: evalToWhiteCp(evAfter),
        moverGainCp: -loss,
      });
    }

    let enriched;
    try {
      enriched = await explainMovesWithGpt({ locale, moves: rows });
    } catch (e) {
      // Do not fail full analysis when OpenAI is temporarily unavailable.
      console.error("coach.analyze gpt fallback:", e);
      enriched = rows.map((m) => ({
        ...m,
        gptComment: fallbackGptComment(locale, m.label, m.san),
      }));
    }

    const analysisDoc = {
      gameId,
      createdAt: FieldValue.serverTimestamp(),
      engineDepth,
      summary:
        locale === "ru"
          ? `Анализ: ${movesSan.length} ходов, depth ${engineDepth}.`
          : `Analysis: ${movesSan.length} moves, depth ${engineDepth}.`,
      moves: enriched.map((m) => ({
        index: m.index,
        san: m.san,
        mover: m.mover,
        label: m.label,
        evBefore: m.evBefore,
        evAfter: m.evAfter,
        gptComment: m.gptComment,
      })),
    };

    let skippedBecauseCached = false;

    await db.runTransaction(async (tx) => {
      const existingAnalysis = await tx.get(analysisRef);
      if (existingAnalysis.exists) {
        skippedBecauseCached = true;
        return;
      }

      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("no_user");

      const data = snap.data() || {};
      const premium = Boolean(data?.premium?.isElite);

      const quota = data?.coach?.monthlyQuota || {};
      const nowTs = Timestamp.now();
      let periodStart =
        quota.periodStart instanceof Timestamp ? quota.periodStart : nowTs;

      const currentMonthStartMs = monthStart(nowTs).getTime();
      const storedMonthStartMs = monthStart(periodStart).getTime();

      let used = Number(quota.freeAnalysesUsed || 0);
      if (storedMonthStartMs < currentMonthStartMs) {
        used = 0;
        periodStart = Timestamp.fromDate(new Date(currentMonthStartMs));
      }

      if (!premium && used >= FREE_MONTHLY_ANALYSIS_LIMIT) {
        const err = new Error("quota_exceeded");
        err.code = "quota_exceeded";
        throw err;
      }

      tx.create(analysisRef, analysisDoc);

      if (!premium) {
        tx.update(userRef, {
          "coach.monthlyQuota.freeAnalysesUsed": used + 1,
          "coach.monthlyQuota.periodStart": periodStart,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(userRef, { updatedAt: FieldValue.serverTimestamp() });
      }
    });

    const saved = await analysisRef.get();
    if (!saved.exists) {
      return Response.json({ error: "server_error" }, { status: 500 });
    }

    return Response.json({
      ok: true,
      cached: skippedBecauseCached,
      analysis: saved.data(),
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (code === "quota_exceeded") {
      return Response.json({ error: "quota_exceeded" }, { status: 402 });
    }
    if (code === "Unauthorized" || code === "unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error(e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
