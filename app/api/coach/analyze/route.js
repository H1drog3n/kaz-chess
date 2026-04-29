import { FieldValue, Timestamp } from "firebase-admin/firestore";
import OpenAI from "openai";
import {
  classifyMoveFromMoverGain,
  evalToWhiteCp,
  moverLossCp,
  orientEvalToWhitePov,
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
  const moverTextRu = (mover) => (mover === "b" ? "чёрных" : "белых");
  const moverTextEn = (mover) => (mover === "b" ? "Black" : "White");
  return (mover) => {
  if (locale === "ru") {
    switch (label) {
      case "brilliant":
          return `Ход ${s} за ${moverTextRu(mover)} — бриллиант. Он резко улучшает координацию фигур и создает активный план с инициативой. В продолжении сопернику сложнее защищаться: часто возникают тактические удары вроде вилки, связки или решающего вторжения по открытой линии.`;
      case "good":
          return `Ход ${s} за ${moverTextRu(mover)} хороший. Он сохраняет баланс и улучшает позицию без лишнего риска. Дальше это обычно дает комфортную игру: больше полезных ходов и меньше шансов допустить тактический удар в ответ.`;
        case "neutral":
          return `Ход ${s} за ${moverTextRu(mover)} нейтральный. В ровной или дебютной позиции он почти не меняет оценку и не создает немедленных угроз. Это не ошибка, но и без давления: чтобы получить преимущество, нужно точнее развивать фигуры и бороться за ключевые поля.`;
      case "inaccuracy":
          return `Неточность ${s} за ${moverTextRu(mover)}. Идея хода понятна, но выполнена не самым точным способом, поэтому часть преимущества теряется. В дальнейшем соперник может перехватить инициативу и получить тактический ресурс — например, темп с угрозой вилки или связки.`;
      case "mistake":
          return `Ошибка ${s} за ${moverTextRu(mover)}. После этого позиция заметно слабеет: ухудшается безопасность короля или координация фигур. В продолжении соперник нередко получает форсированный план с материальным выигрышем либо сильной атакой.`;
      case "blunder":
          return `Зевок ${s} за ${moverTextRu(mover)}. Ход допускает резкий тактический провал: потерю материала или критическое ослабление короля. Обычно дальше у соперника появляется конкретная комбинация (вилка, связка, вскрытое нападение), и позицию уже очень трудно спасти точной защитой.`;
      default:
          return `Ход ${s} за ${moverTextRu(mover)} оценен движком как рабочий. Посмотри метку качества и сравни с альтернативами: часто разница в одном темпе меняет инициативу. Главная цель — понять, какой план ход улучшает и какие тактические риски оставляет.`;
    }
  }
  switch (label) {
    case "brilliant":
        return `${moverTextEn(mover)} move ${s} is brilliant. It sharply improves piece coordination and creates active play with initiative. In practical continuation, this often leads to tactical chances such as forks, pins, or a decisive invasion on open lines.`;
    case "good":
        return `${moverTextEn(mover)} move ${s} is good. It keeps the position healthy and improves play without unnecessary risk. Going forward, it usually gives easier plans and reduces the opponent's tactical counterplay.`;
      case "neutral":
        return `${moverTextEn(mover)} move ${s} is neutral. In an opening/equal position it keeps the evaluation almost unchanged and creates no immediate pressure. It is not a mistake, but stronger follow-up moves are needed to gain initiative.`;
    case "inaccuracy":
        return `${moverTextEn(mover)} move ${s} is an inaccuracy. The idea is playable, but less precise than the best continuation, so part of the edge slips away. This can allow the opponent to seize initiative and generate tactical threats (for example a fork or pin with tempo).`;
    case "mistake":
        return `${moverTextEn(mover)} move ${s} is a mistake. The position worsens clearly, often due to king safety or poor piece coordination. In many lines the opponent gets a forcing plan with material gain or a lasting attack.`;
    case "blunder":
        return `${moverTextEn(mover)} move ${s} is a blunder. It allows a major tactical collapse: material loss or critical king exposure. The opponent typically has a concrete sequence (fork, pin, discovered attack), and accurate defense becomes very difficult.`;
    default:
        return `${moverTextEn(mover)} move ${s} is assessed by the engine as serviceable. Use the label and alternatives to understand why one tempo changes who controls the game. The key is to connect the move with a clear plan and the tactical risks it leaves behind.`;
    }
  };
}

function isNeutralOpeningMove({ index, moverGainCp, cpAfter }) {
  if (index > 11) return false;
  if (Math.abs(Number(moverGainCp) || 0) > 18) return false;
  if (Math.abs(Number(cpAfter) || 0) > 80) return false;
  return true;
}

function withLabelAdjustments(row) {
  const cpAfter = Number(row.cpAfter) || 0;
  if (isNeutralOpeningMove({ index: row.index, moverGainCp: row.moverGainCp, cpAfter })) {
    return { ...row, label: "neutral" };
  }
  return row;
}

function fallbackRows(locale, rows) {
  return rows.map((m) => ({
    ...m,
    gptComment: fallbackGptComment(locale, m.label, m.san)(m.mover),
  }));
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
      gptComment: fallbackGptComment(locale, m.label, m.san)(m.mover) + suffix,
    }));
  }

  const client = new OpenAI({ apiKey });

  const system =
    locale === "ru"
      ? "Ты шахматный тренер. Для каждого хода напиши содержательный комментарий на русском в 2–3 предложениях. Формат: (1) качество хода по метке, (2) почему это хорошо/плохо позиционно или тактически, (3) что может случиться дальше (план, угроза, типовой тактический мотив: вилка/связка/вскрытое нападение/атака на короля). Пиши понятно, без воды и без фантазий, опираясь на cpBefore/cpAfter/moverGainCp."
      : "You are a chess coach. For each move, write a meaningful 2–3 sentence comment in English. Structure: (1) move quality by label, (2) why it is good/bad positionally or tactically, (3) likely consequence in the next phase (plan, threat, or tactical motif like fork/pin/discovered attack/king attack). Be concrete, avoid fluff and speculation, and use cpBefore/cpAfter/moverGainCp.";

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
            "Return JSON ONLY: {comments:[{index:number, comment:string}]} — one comment per move index from this chunk, each comment 2–3 sentences. Indices must match exactly. No markdown.",
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
      byIdx.get(m.index) || fallbackGptComment(locale, m.label, m.san)(m.mover),
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
      const evBefore = orientEvalToWhitePov(evals[i], mover);
      const evAfter = orientEvalToWhitePov(evals[i + 1], mover === "w" ? "b" : "w");
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
    const adjustedRows = rows.map(withLabelAdjustments);

    let enriched;
    try {
      enriched = await explainMovesWithGpt({ locale, moves: adjustedRows });
    } catch (e) {
      // Do not fail full analysis when OpenAI is temporarily unavailable.
      console.error("coach.analyze gpt fallback:", e);
      enriched = fallbackRows(locale, adjustedRows);
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
