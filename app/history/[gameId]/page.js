"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { getFirebaseDb } from "../../../lib/firebase";
import { BOARD_THEMES, coerceBoardTheme } from "../../../lib/boardThemes";
import { safeLocalStorageGet } from "../../../lib/clientStorage";
import { labelForMode, labelForReason } from "../../../lib/gameLabels";
import { useLocale } from "../../../contexts/LocaleContext";
import { useStockfish } from "../../../hooks/useStockfish";
import { makeCustomPieces } from "../../../components/chess/makeCustomPieces";

/** Client-side Stockfish depth — lower than tournament analysis for faster UX. */
const COACH_EVAL_DEPTH = 8;
/** Mate/stalemate/draw: shallow search — avoids long stalls on terminal FENs in stockfish.wasm. */
const COACH_EVAL_DEPTH_TERMINAL = 5;
/** Per-position cap; prevents “10/11 forever” if wasm never finishes one `go depth`. */
const COACH_EVAL_TIMEOUT_MS = 28000;

function normalizeEval(ev) {
  if (ev && (ev.kind === "cp" || ev.kind === "mate")) return ev;
  return { kind: "cp", cp: 0 };
}

export default function HistoryReplayPage() {
  const params = useParams();
  const gameId = Array.isArray(params.gameId)
    ? params.gameId[0]
    : params.gameId;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { locale, t, labelCoach } = useLocale();
  const toast = useToast();
  const { evaluateFen } = useStockfish();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [step, setStep] = useState(0);
  const [boardThemeKey, setBoardThemeKey] = useState("classic");
  const [pieceSetKey, setPieceSetKey] = useState("classic");

  const [analysis, setAnalysis] = useState(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(null);

  useEffect(() => {
    const v = safeLocalStorageGet("boardTheme", "classic");
    setBoardThemeKey(coerceBoardTheme(v));
    const ps = safeLocalStorageGet("pieceSet", "classic");
    if (typeof ps === "string") setPieceSetKey(ps);
  }, []);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const ap = snap.data()?.cosmetics?.activePieceSet;
      if (typeof ap === "string") setPieceSetKey(ap);
    });
  }, [user]);

  const load = useCallback(async () => {
    const db = getFirebaseDb();
    if (!db || !user || !gameId) return;
    setErr(null);
    try {
      const ref = doc(db, "chessGames", gameId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setErr(t("game_not_found"));
        return;
      }
      const d = snap.data();
      if (d.userId !== user.uid) {
        setErr(t("game_forbidden"));
        return;
      }
      setData(d);
      setStep(0);
    } catch (e) {
      setErr(e?.message || "Failed to load");
    }
  }, [user, gameId, t]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  useEffect(() => {
    if (!user || !gameId) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid, "analyses", gameId))
      .then((snap) => {
        if (snap.exists()) setAnalysis(snap.data());
      })
      .catch(() => {});
  }, [user, gameId]);

  const { fen, maxStep } = useMemo(() => {
    const g = new Chess();
    const verboseMoves = Array.isArray(data?.moves) ? data.moves : [];
    const sanMoves = Array.isArray(data?.movesSan) ? data.movesSan : [];

    // Prefer verbose move list if present, else fall back to SAN list.
    const useVerbose = verboseMoves.length > 0;
    const total = useVerbose ? verboseMoves.length : sanMoves.length;
    const n = Math.min(step, total);

    for (let i = 0; i < n; i++) {
      if (useVerbose) {
        const m = verboseMoves[i];
        g.move({ from: m.from, to: m.to, promotion: m.promotion });
      } else {
        g.move(sanMoves[i]);
      }
    }
    return { fen: g.fen(), maxStep: total };
  }, [data, step]);

  const boardTheme = BOARD_THEMES[boardThemeKey] || BOARD_THEMES.classic;
  // Use react-chessboard default SVG pieces for "classic".
  const customPieces = useMemo(() => {
    if (!pieceSetKey || pieceSetKey === "classic") return undefined;
    return makeCustomPieces(pieceSetKey);
  }, [pieceSetKey]);

  async function runAnalysis() {
    if (!user || !data) {
      toast.error(t("coach_no_auth"));
      return;
    }
    try {
      setAnalyzeBusy(true);
      setAnalyzeProgress(null);

      const sanMoves = Array.isArray(data.movesSan)
        ? data.movesSan.map(String)
        : Array.isArray(data.moves)
          ? data.moves.map((m) => String(m.san))
          : [];

      if (!sanMoves.length) {
        toast.error(t("coach_failed"));
        return;
      }

      if (typeof evaluateFen !== "function") {
        toast.error(t("stockfish_not_ready"));
        return;
      }

      const g = new Chess();
      const evals = [];
      const totalPositions = sanMoves.length + 1;
      let done = 0;
      const pushProgress = () => {
        done += 1;
        setAnalyzeProgress({ done, total: totalPositions, phase: "eval" });
      };

      async function evaluateGamePosition(game) {
        const fen = game.fen();
        const terminal = game.isGameOver();
        const depth = terminal ? COACH_EVAL_DEPTH_TERMINAL : COACH_EVAL_DEPTH;
        return normalizeEval(await evaluateFen(fen, depth, COACH_EVAL_TIMEOUT_MS));
      }

      evals.push(await evaluateGamePosition(g));
      pushProgress();

      for (const san of sanMoves) {
        g.move(san);
        evals.push(await evaluateGamePosition(g));
        pushProgress();
      }

      setAnalyzeProgress({
        done: totalPositions,
        total: totalPositions,
        phase: "server",
      });

      const idToken = await user.getIdToken();
      const res = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          gameId,
          movesSan: sanMoves,
          evals,
          engineDepth: COACH_EVAL_DEPTH,
          locale,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (res.status === 402) {
        toast.error(t("coach_quota_reached"));
        return;
      }
      if (!res.ok && payload?.error === "firebase_admin_not_configured") {
        toast.error(t("server_not_configured"));
        return;
      }
      if (!res.ok) throw new Error(payload?.error || "error");

      setAnalysis(payload.analysis);
      toast.success(t("coach_ready"));
    } catch (e) {
      console.error(e);
      toast.error(t("coach_failed"));
    } finally {
      setAnalyzeBusy(false);
      setAnalyzeProgress(null);
    }
  }

  const sanitizedPgn = useMemo(() => {
    const p = String(data?.pgn || "");
    if (!p) return "";
    // Strip PGN headers like [Event "?"]
    return p
      .split("\n")
      .filter((line) => !line.trim().startsWith("["))
      .join("\n")
      .trim();
  }, [data]);

  if (authLoading) {
    return <div className="p-8 text-center text-zinc-500">{t("loading")}</div>;
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <Link href="/login" className="text-blue-600 underline">
          {t("replay_login_prompt")}
        </Link>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4 text-red-600">{err}</p>
        <button
          type="button"
          className="text-blue-600 underline"
          onClick={() => router.push("/history")}
        >
          {t("back_to_history")}
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-zinc-500">{t("loading_game")}</div>;
  }

  const moveRows = Array.isArray(analysis?.moves) ? analysis.moves : [];
  const activeRow = step > 0 ? moveRows[step - 1] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("replay_title")}</h1>
        <Link href="/history" className="text-sm text-blue-600 underline">
          {t("back_to_list")}
        </Link>
      </div>
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("result")}: <span className="font-medium capitalize">{data.result}</span>
        {data.reason && <> · {labelForReason(data.reason, locale)}</>}
        {data.mode && <> · {labelForMode(data.mode, locale)}</>}
        {data.timeControl && (
          <> · {t("time")}: {String(data.timeControl)}</>
        )}
        {data.stockfishLevel != null && (
          <> · {t("stockfish_level_label")} {data.stockfishLevel}</>
        )}
      </p>
      <div className="mx-auto mb-4 w-full max-w-[480px]">
        <Chessboard
          position={fen}
          boardOrientation="white"
          arePiecesDraggable={false}
          customPieces={customPieces}
          customBoardStyle={{ borderRadius: 8 }}
          customLightSquareStyle={{ backgroundColor: boardTheme.light }}
          customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
        />
      </div>

      <div className="mx-auto mb-4 flex max-w-[480px] flex-col gap-2">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={analyzeBusy}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {analyzeBusy ? t("coach_analyzing") : t("coach_analyze")}
        </button>
        {analyzeBusy && analyzeProgress && (
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
            {analyzeProgress.phase === "server"
              ? t("coach_phase_server")
              : `${t("coach_analyze_positions")}: ${analyzeProgress.done} / ${analyzeProgress.total}`}
          </p>
        )}
        {analysis && (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            {step === 0 ? (
              <p className="text-zinc-700 dark:text-zinc-300">{t("coach_replay_step_zero")}</p>
            ) : activeRow ? (
              <>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{activeRow.san}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">
                    {labelCoach(activeRow.label)}
                  </span>
                </div>
                <div className="text-zinc-700 dark:text-zinc-300">{activeRow.gptComment}</div>
              </>
            ) : (
              <p className="text-zinc-500">{t("loading")}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          {t("prev")}
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("moves")} {step} / {maxStep}
        </span>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
        >
          {t("next")}
        </button>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          onClick={() => setStep(0)}
        >
          {t("start")}
        </button>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          onClick={() => setStep(maxStep)}
        >
          {t("end")}
        </button>
      </div>
      {sanitizedPgn && (
        <details className="mt-6 rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="cursor-pointer select-none text-sm font-medium">
            PGN ({t("moves")})
          </summary>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-700 dark:text-zinc-300">
            {sanitizedPgn}
          </pre>
        </details>
      )}
    </div>
  );
}
