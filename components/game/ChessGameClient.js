"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useStockfish } from "../../hooks/useStockfish";
import {
  findKingSquare,
  getLegalMovesVerboseFromSquare,
  getLegalTargetSquares,
} from "../../lib/chessUi";
import { depthForLevel } from "../../lib/stockfishLevels";
import { getGameStatus } from "../../lib/gameStatus";
import { resultForWhitePlayer, resultForWhitePvp } from "../../lib/gameResult";
import { saveFinishedGame } from "../../lib/saveGame";
import {
  DEFAULT_ELO,
  engineRatingForLevel,
  nextElo,
} from "../../lib/elo";
import { updateUserElo } from "../../lib/profileDb";
import { getFirebaseDb } from "../../lib/firebase";
import { BOARD_THEMES, coerceBoardTheme } from "../../lib/boardThemes";
import { safeLocalStorageGet } from "../../lib/clientStorage";
import { useLocale } from "../../contexts/LocaleContext";
import { makeCustomPieces } from "../chess/makeCustomPieces";

function buildGameFromSan(movesSan, fallbackFen) {
  const g = new Chess();
  for (const san of movesSan) {
    try {
      g.move(san);
    } catch {
      if (fallbackFen) {
        try {
          g.load(fallbackFen);
        } catch {
          // ignore
        }
      }
      break;
    }
  }
  return g;
}

function tryMove(game, sourceSquare, targetSquare) {
  const piece = game.get(sourceSquare);
  const rank = targetSquare[1];
  const isPromotion =
    piece?.type === "p" && (rank === "8" || rank === "1");
  return game.move({
    from: sourceSquare,
    to: targetSquare,
    ...(isPromotion ? { promotion: "q" } : {}),
  });
}

function applyUciMove(game, uci) {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length >= 5 ? uci[4] : undefined;
  return game.move({ from, to, promotion });
}

const TIME_PRESETS = {
  none: { label: "Без времени", seconds: null },
  bullet60: { label: "Bullet 1+0", seconds: 60 },
  blitz180: { label: "Blitz 3+0", seconds: 180 },
  rapid600: { label: "Rapid 10+0", seconds: 600 },
};

function initialMsFromTimeControl(timePresetKey, customMinutes) {
  if (timePresetKey === "none") return { whiteMs: null, blackMs: null };
  if (timePresetKey === "custom") {
    const sec = Math.max(30, (Number(customMinutes) || 5) * 60);
    return { whiteMs: sec * 1000, blackMs: sec * 1000 };
  }
  const sec = TIME_PRESETS[timePresetKey]?.seconds ?? null;
  return sec == null ? { whiteMs: null, blackMs: null } : { whiteMs: sec * 1000, blackMs: sec * 1000 };
}

export function ChessGameClient({
  initialPlayMode = "pvp",
  initialStockfishLevel = 6,
  initialRated = false,
  initialTimeControlKey = "none",
  initialCustomMinutes = 5,
  hideSetup = false,
} = {}) {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const { findBestMoveUci, evaluateFen } = useStockfish();

  const [movesSan, setMovesSan] = useState([]);
  const [viewIdx, setViewIdx] = useState(0);
  const [positionFens, setPositionFens] = useState(() => [new Chess().fen()]);

  const [playMode, setPlayMode] = useState(
    initialPlayMode === "ai" || initialPlayMode === "pvp"
      ? initialPlayMode
      : "pvp"
  );
  const [stockfishLevel, setStockfishLevel] = useState(() => {
    const n = Number(initialStockfishLevel) || 6;
    return Math.min(9, Math.max(1, n));
  });
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [rated, setRated] = useState(Boolean(initialRated));

  const [timePresetKey, setTimePresetKey] = useState(() => {
    const allowed = new Set(["none", "bullet60", "blitz180", "rapid600", "custom"]);
    return allowed.has(initialTimeControlKey) ? initialTimeControlKey : "none";
  });
  const [customMinutes, setCustomMinutes] = useState(() => {
    const n = Number(initialCustomMinutes) || 5;
    return Math.min(120, Math.max(1, n));
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [whiteMs, setWhiteMs] = useState(() => {
    return initialMsFromTimeControl(initialTimeControlKey, initialCustomMinutes)
      .whiteMs;
  });
  const [blackMs, setBlackMs] = useState(() => {
    return initialMsFromTimeControl(initialTimeControlKey, initialCustomMinutes)
      .blackMs;
  });
  const [timeWinner, setTimeWinner] = useState(null);

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [engineMessage, setEngineMessage] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [boardThemeKey, setBoardThemeKey] = useState("classic");
  const [pieceSetKey, setPieceSetKey] = useState("classic");

  const aiRequestRef = useRef(0);
  const savedPgnRef = useRef(null);
  const gameRef = useRef(new Chess());
  const positionFensRef = useRef(positionFens);
  positionFensRef.current = positionFens;

  const atLiveTip = viewIdx === positionFens.length - 1;

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

  const liveGame = useMemo(() => {
    // IMPORTANT: draw rules (threefold repetition / 50-move) require move history.
    const tipFen = positionFens[positionFens.length - 1];
    const g = buildGameFromSan(movesSan, tipFen);
    gameRef.current = g;
    return g;
  }, [movesSan, positionFens]);

  const displayGame = useMemo(() => {
    const g = new Chess();
    g.load(positionFens[viewIdx]);
    return g;
  }, [positionFens, viewIdx]);

  const chessGameOver = liveGame.isGameOver();
  const effectiveGameOver = chessGameOver || timeWinner !== null;
  const status = useMemo(
    () => getGameStatus(liveGame, timeWinner, locale),
    [liveGame, timeWinner, locale]
  );

  const boardOrientation =
    playMode === "ai" ? "white" : liveGame.turn() === "w" ? "white" : "black";

  const timerActive =
    gameStarted &&
    timePresetKey !== "none" &&
    whiteMs !== null &&
    blackMs !== null &&
    !effectiveGameOver;

  useEffect(() => {
    if (!timerActive) return undefined;
    const id = setInterval(() => {
      const g = gameRef.current;
      const turn = g.turn();
      if (turn === "w") {
        setWhiteMs((ms) => {
          if (ms === null) return ms;
          const n = ms - 1000;
          if (n <= 0) {
            setTimeWinner("b");
            return 0;
          }
          return n;
        });
      } else {
        setBlackMs((ms) => {
          if (ms === null) return ms;
          const n = ms - 1000;
          if (n <= 0) {
            setTimeWinner("w");
            return 0;
          }
          return n;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive]);

  const runAiIfNeeded = useCallback(
    (fenAfterWhite) => {
      const next = new Chess(fenAfterWhite);
      if (playMode !== "ai" || next.turn() !== "b" || next.isGameOver()) return;

      const req = ++aiRequestRef.current;
      setAiThinking(true);
      const depth = depthForLevel(stockfishLevel);

      const fenForAi = next.fen();

      findBestMoveUci(fenForAi, depth).then((uci) => {
        if (req !== aiRequestRef.current) return;
        setAiThinking(false);
        if (!uci) {
          setEngineMessage(
            t("stockfish_no_move")
          );
          return;
        }
        setEngineMessage(null);

        const fens = positionFensRef.current;
        const tip = fens[fens.length - 1];
        if (tip !== fenForAi) return;
        const verify = new Chess(tip);
        if (verify.turn() !== "b" || verify.isGameOver()) return;

        const copy = new Chess(tip);
        const applied = applyUciMove(copy, uci);
        if (!applied) return;
        setPositionFens([...fens, copy.fen()]);
        setMovesSan((m) => [...m, applied.san]);
        setViewIdx((i) => i + 1);
      });
    },
    [findBestMoveUci, playMode, stockfishLevel]
  );

  const applyHumanMove = useCallback(
    (sourceSquare, targetSquare) => {
      if (!atLiveTip || effectiveGameOver || aiThinking) return false;
      const base = new Chess(liveGame.fen());
      const move = tryMove(base, sourceSquare, targetSquare);
      if (!move) return false;

      if (!gameStarted && timePresetKey !== "none") {
        let sec = TIME_PRESETS[timePresetKey]?.seconds;
        if (timePresetKey === "custom") sec = Math.max(30, customMinutes * 60);
        if (sec != null) {
          setWhiteMs(sec * 1000);
          setBlackMs(sec * 1000);
        }
        setGameStarted(true);
      } else if (!gameStarted) {
        setGameStarted(true);
      }

      setPositionFens((fens) => [...fens, base.fen()]);
      setMovesSan((m) => [...m, move.san]);
      setViewIdx((v) => v + 1);
      setSelectedSquare(null);

      if (playMode === "ai") {
        const fenAfter = base.fen();
        if (!base.isGameOver()) {
          runAiIfNeeded(fenAfter);
        }
      }
      return true;
    },
    [
      atLiveTip,
      effectiveGameOver,
      aiThinking,
      liveGame,
      playMode,
      runAiIfNeeded,
      timePresetKey,
      customMinutes,
      gameStarted,
    ]
  );

  const onPieceDrop = useCallback(
    (sourceSquare, targetSquare) => {
      return applyHumanMove(sourceSquare, targetSquare);
    },
    [applyHumanMove]
  );

  const onPieceDragBegin = useCallback(
    (_piece, sourceSquare) => {
      if (!atLiveTip || effectiveGameOver || aiThinking) return;
      const g = liveGame;
      const p = g.get(sourceSquare);
      if (!p) return;
      if (p.color !== g.turn()) return;
      if (playMode === "ai" && p.color !== "w") return;
      setSelectedSquare(sourceSquare);
    },
    [atLiveTip, effectiveGameOver, aiThinking, liveGame, playMode]
  );

  const onPieceDragEnd = useCallback(() => {
    // If drop succeeds, applyHumanMove clears selection; otherwise clear on cancel.
    setSelectedSquare(null);
  }, []);

  const onSquareClick = useCallback(
    (square) => {
      if (!atLiveTip || effectiveGameOver || aiThinking) return;
      const g = liveGame;
      const piece = g.get(square);
      if (selectedSquare) {
        const targets = getLegalTargetSquares(g, selectedSquare);
        if (targets.includes(square)) {
          applyHumanMove(selectedSquare, square);
          return;
        }
      }
      if (piece && piece.color === g.turn()) {
        if (playMode === "ai" && piece.color !== "w") return;
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [
      atLiveTip,
      effectiveGameOver,
      aiThinking,
      liveGame,
      selectedSquare,
      applyHumanMove,
      playMode,
    ]
  );

  const legalMovesVerbose = useMemo(() => {
    if (!selectedSquare || !atLiveTip) return [];
    return getLegalMovesVerboseFromSquare(liveGame, selectedSquare);
  }, [selectedSquare, liveGame, atLiveTip]);

  const checkedKingSquare = useMemo(() => {
    if (!liveGame.isCheck() || liveGame.isGameOver() || timeWinner) return null;
    return findKingSquare(liveGame, liveGame.turn());
  }, [liveGame, timeWinner]);

  const customSquareStyles = useMemo(() => {
    const styles = {};
    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        backgroundColor: "rgba(239, 68, 68, 0.6)",
        boxShadow: "inset 0 0 0 3px rgb(185, 28, 28)",
      };
    }
    if (selectedSquare && atLiveTip) {
      const prev = styles[selectedSquare] || {};
      styles[selectedSquare] = {
        ...prev,
        boxShadow: [prev.boxShadow, "inset 0 0 0 2px rgba(250, 204, 21, 0.95)"]
          .filter(Boolean)
          .join(", "),
      };
    }
    for (const m of legalMovesVerbose) {
      const sq = m.to;
      if (sq === checkedKingSquare) continue;
      if (m.captured) {
        styles[sq] = {
          ...styles[sq],
          backgroundColor: "rgba(239, 68, 68, 0.55)",
          boxShadow: "inset 0 0 0 4px rgb(220, 38, 38), 0 0 0 2px rgba(0,0,0,0.08)",
        };
      } else {
        styles[sq] = {
          ...styles[sq],
          backgroundColor: "rgba(34, 197, 94, 0.35)",
          boxShadow: "inset 0 0 0 4px rgba(34, 197, 94, 0.9)",
        };
      }
    }
    return styles;
  }, [
    liveGame,
    legalMovesVerbose,
    timeWinner,
    checkedKingSquare,
    selectedSquare,
    atLiveTip,
  ]);

  const boardTheme = BOARD_THEMES[boardThemeKey] || BOARD_THEMES.classic;
  // Use react-chessboard default SVG pieces for "classic".
  // Custom piece skins apply only to non-classic sets.
  const customPieces = useMemo(() => {
    if (!pieceSetKey || pieceSetKey === "classic") return undefined;
    return makeCustomPieces(pieceSetKey);
  }, [pieceSetKey]);

  const resetBoard = useCallback(() => {
    aiRequestRef.current += 1;
    setAiThinking(false);
    setEngineMessage(null);
    setSaveMessage(null);
    savedPgnRef.current = null;
    setPositionFens([new Chess().fen()]);
    setMovesSan([]);
    setViewIdx(0);
    setSelectedSquare(null);
    setTimeWinner(null);
    setGameStarted(false);
    if (timePresetKey !== "none") {
      let sec = TIME_PRESETS[timePresetKey]?.seconds;
      if (timePresetKey === "custom") sec = Math.max(30, customMinutes * 60);
      if (sec != null) {
        setWhiteMs(sec * 1000);
        setBlackMs(sec * 1000);
      } else {
        setWhiteMs(null);
        setBlackMs(null);
      }
    } else {
      setWhiteMs(null);
      setBlackMs(null);
    }
  }, [timePresetKey, customMinutes]);

  const setMode = useCallback((mode) => {
    setPlayMode(mode);
    if (mode === "pvp") setRated(false);
    resetBoard();
  }, [resetBoard]);

  const undoLast = useCallback(() => {
    if (rated || !atLiveTip || positionFens.length < 2) return;
    if (aiThinking) return;
    aiRequestRef.current += 1;
    setAiThinking(false);
    setPositionFens((f) => f.slice(0, -1));
    setMovesSan((m) => m.slice(0, -1));
    setViewIdx((v) => Math.max(0, v - 1));
    setSelectedSquare(null);
  }, [rated, atLiveTip, positionFens.length, aiThinking]);

  const liveFenTip = liveGame.fen();

  useEffect(() => {
    if (playMode !== "ai" && rated) setRated(false);
  }, [playMode, rated]);

  useEffect(() => {
    if (timePresetKey !== "custom" || positionFens.length > 1) return;
    const sec = Math.max(30, customMinutes * 60);
    setWhiteMs(sec * 1000);
    setBlackMs(sec * 1000);
  }, [customMinutes, timePresetKey, positionFens.length]);

  useEffect(() => {
    if (!effectiveGameOver || !user) return;
    const pgn = liveGame.pgn();
    if (savedPgnRef.current === pgn) return;
    savedPgnRef.current = pgn;

    const tc =
      timePresetKey === "custom"
        ? `custom_${customMinutes}m`
        : timePresetKey;

    const result =
      playMode === "ai"
        ? resultForWhitePlayer(liveGame, timeWinner)
        : resultForWhitePvp(liveGame, timeWinner);

    const initW =
      TIME_PRESETS[timePresetKey]?.seconds ??
      (timePresetKey === "custom" ? customMinutes * 60 : null);

    (async () => {
      setSaveMessage(null);
      let eloBefore = null;
      let eloAfter = null;
      if (rated && playMode === "ai") {
        const db = getFirebaseDb();
        if (db) {
          const snap = await getDoc(doc(db, "users", user.uid));
          eloBefore = snap.exists() ? snap.data().elo ?? DEFAULT_ELO : DEFAULT_ELO;
          const score =
            result === "win" ? 1 : result === "lose" ? 0 : 0.5;
          eloAfter = nextElo(
            eloBefore,
            engineRatingForLevel(stockfishLevel),
            score
          );
          await updateUserElo(user.uid, eloAfter);
        }
      }
      await saveFinishedGame({
        userId: user.uid,
        game: liveGame,
        mode: playMode,
        result,
        timeWinner,
        timeControl: tc,
        initialSecondsWhite: initW,
        initialSecondsBlack: initW,
        stockfishLevel: playMode === "ai" ? stockfishLevel : null,
        rated: rated && playMode === "ai",
        eloBefore,
        eloAfter,
      });
      setSaveMessage(t("saved_history"));
    })().catch((e) => {
      console.error(e);
      const code = e?.code ? ` (${e.code})` : "";
      setSaveMessage(`${t("save_failed")}${code}`);
    });
  }, [
    effectiveGameOver,
    user,
    liveFenTip,
    movesSan,
    playMode,
    timeWinner,
    timePresetKey,
    customMinutes,
    stockfishLevel,
    rated,
    liveGame,
    locale,
    t,
  ]);

  const isDraggablePiece = useCallback(
    ({ piece }) => {
      if (!atLiveTip || effectiveGameOver || aiThinking) return false;
      if (playMode === "ai") {
        return piece[0] === "w" && liveGame.turn() === "w";
      }
      return (
        (piece[0] === "w" && liveGame.turn() === "w") ||
        (piece[0] === "b" && liveGame.turn() === "b")
      );
    },
    [atLiveTip, effectiveGameOver, aiThinking, playMode, liveGame]
  );

  const formatClock = (ms) => {
    if (ms == null) return "—";
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < movesSan.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: movesSan[i],
        black: movesSan[i + 1] || "",
        startIdx: i,
      });
    }
    return pairs;
  }, [movesSan]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="mb-3 flex w-full max-w-[min(100%,560px)] items-center justify-between gap-2 text-sm">
          <div
            className={`rounded-lg px-3 py-2 font-mono ${
              liveGame.turn() === "w" && timerActive
                ? "bg-emerald-100 font-semibold dark:bg-emerald-900/40"
                : liveGame.turn() === "w" && !effectiveGameOver
                  ? "ring-2 ring-emerald-500/60 bg-zinc-100 dark:bg-zinc-800"
                  : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {t("white")} {formatClock(whiteMs)}
          </div>
          <div
            className={`rounded-lg px-3 py-2 font-mono ${
              liveGame.turn() === "b" && timerActive
                ? "bg-emerald-100 font-semibold dark:bg-emerald-900/40"
                : liveGame.turn() === "b" && !effectiveGameOver
                  ? "ring-2 ring-emerald-500/60 bg-zinc-100 dark:bg-zinc-800"
                  : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {t("black")} {formatClock(blackMs)}
          </div>
        </div>

        {!effectiveGameOver && (
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
              {liveGame.turn() === "w" ? t("white_to_move") : t("black_to_move")}
            </span>
            {liveGame.isCheck() && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                {t("check")}
              </span>
            )}
          </div>
        )}

        <div className="mb-3 min-h-[52px] w-full max-w-md text-center">
          <div
            className={`text-lg font-semibold ${
              effectiveGameOver ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {status.label}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {status.detail}
          </div>
        </div>

        <div className="relative w-full max-w-[560px] min-w-0">
          <Chessboard
            position={displayGame.fen()}
            onPieceDrop={onPieceDrop}
            onPieceDragBegin={onPieceDragBegin}
            onPieceDragEnd={onPieceDragEnd}
            onSquareClick={onSquareClick}
            boardOrientation={boardOrientation}
            customPieces={customPieces}
            arePiecesDraggable={
              atLiveTip && !effectiveGameOver && !aiThinking
            }
            isDraggablePiece={isDraggablePiece}
            customSquareStyles={customSquareStyles}
            animationDuration={200}
            customLightSquareStyle={{ backgroundColor: boardTheme.light }}
            customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
            customBoardStyle={{
              borderRadius: 8,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
          />
        </div>

        {!hideSetup && (
          <>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setMode("pvp")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  playMode === "pvp"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                }`}
              >
                {t("mode_pvp")}
              </button>
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  playMode === "ai"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                }`}
              >
                {t("mode_ai")}
              </button>
              <button
                type="button"
                onClick={() => setShowLevelModal(true)}
                className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                title="Stockfish strength"
              >
                ♟ Level {stockfishLevel}
              </button>
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rated}
                onChange={(e) => setRated(e.target.checked)}
                disabled={playMode !== "ai"}
                className="rounded"
              />
              Rated (AI only, Elo updates, no undo)
            </label>
          </>
        )}

        {engineMessage && (
          <p className="mt-2 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            {engineMessage}
          </p>
        )}
        {saveMessage && (
          <p className="mt-2 max-w-md rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {saveMessage}
          </p>
        )}
        {aiThinking && (
          <p className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            {t("stockfish_thinking")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={resetBoard}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t("new_game")}
          </button>
          {effectiveGameOver && (
            <button
              type="button"
              onClick={resetBoard}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t("rematch")}
            </button>
          )}
          <button
            type="button"
            onClick={undoLast}
            disabled={rated || !atLiveTip || positionFens.length < 2 || effectiveGameOver}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-zinc-600"
          >
            {t("undo")}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/" className="underline">
            {t("back_home")}
          </Link>
        </p>
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {hideSetup ? (
            <div className="mb-4">
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
                {t("game_setup")}
              </h2>
              <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                <div>
                  <span className="font-semibold">{t("mode")}:</span>{" "}
                  {playMode === "ai" ? "Stockfish" : t("mode_pvp")}
                </div>
                {playMode === "ai" && (
                  <div>
                    <span className="font-semibold">Level:</span> {stockfishLevel}{" "}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      (depth {depthForLevel(stockfishLevel)})
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-semibold">{t("time")}:</span>{" "}
                  {timePresetKey === "custom"
                    ? `Custom ${customMinutes}m`
                    : TIME_PRESETS[timePresetKey]?.label ?? "No timer"}
                </div>
                {playMode === "ai" && (
                  <div>
                    <span className="font-semibold">{t("leaderboard_title")}:</span>{" "}
                    {rated ? "Yes" : "No"}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
                {t("time_control")}
              </h2>
              <div className="mb-3 flex flex-col gap-2">
                {Object.entries(TIME_PRESETS).map(([key, { label }]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="tc"
                      checked={timePresetKey === key}
                      onChange={() => {
                        setTimePresetKey(key);
                        setGameStarted(false);
                        setTimeWinner(null);
                        const ms = initialMsFromTimeControl(key, customMinutes);
                        setWhiteMs(ms.whiteMs);
                        setBlackMs(ms.blackMs);
                      }}
                      disabled={positionFens.length > 1}
                    />
                    {label}
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tc"
                    checked={timePresetKey === "custom"}
                    onChange={() => {
                      setTimePresetKey("custom");
                      const ms = initialMsFromTimeControl("custom", customMinutes);
                      setWhiteMs(ms.whiteMs);
                      setBlackMs(ms.blackMs);
                    }}
                    disabled={positionFens.length > 1}
                  />
                  Своё (минуты)
                </label>
                {timePresetKey === "custom" && (
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={customMinutes}
                    onChange={(e) =>
                      setCustomMinutes(Number(e.target.value) || 5)
                    }
                    className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
                    disabled={positionFens.length > 1}
                  />
                )}
              </div>
            </>
          )}
          {!atLiveTip && (
            <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
              {t("review_mode")}
            </p>
          )}
          <h2 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
            {t("moves")}
          </h2>
          <div className="max-h-64 overflow-y-auto font-mono text-sm">
            {movePairs.map((row) => (
              <div key={row.num} className="flex gap-2 border-b border-zinc-100 py-1 dark:border-zinc-800">
                <span className="w-6 text-zinc-400">{row.num}.</span>
                <button
                  type="button"
                  className={`text-left ${
                    viewIdx === row.startIdx + 1 ? "font-bold text-blue-600" : ""
                  }`}
                  onClick={() => setViewIdx(row.startIdx + 1)}
                >
                  {row.white}
                </button>
                {row.black && (
                  <button
                    type="button"
                    className={`text-left ${
                      viewIdx === row.startIdx + 2 ? "font-bold text-blue-600" : ""
                    }`}
                    onClick={() => setViewIdx(row.startIdx + 2)}
                  >
                    {row.black}
                  </button>
                )}
              </div>
            ))}
            {movesSan.length === 0 && (
              <p className="text-zinc-500">{t("no_games")}</p>
            )}
          </div>
          {viewIdx < positionFens.length - 1 && (
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm text-white"
              onClick={() => setViewIdx(positionFens.length - 1)}
            >
              {t("jump_current")}
            </button>
          )}
        </div>
      </aside>

      {showLevelModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-level-title"
          onClick={() => setShowLevelModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="sf-level-title"
              className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {t("stockfish_strength")}
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {`Уровень 1 — самый слабый, уровень 9 — самый сильный (depth ${depthForLevel(9)}).`}
            </p>
            <input
              type="range"
              min={1}
              max={9}
              value={stockfishLevel}
              onChange={(e) => setStockfishLevel(Number(e.target.value))}
              className="mb-2 w-full"
            />
            <div className="mb-4 flex justify-between text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span>Level {stockfishLevel}</span>
              <span>depth {depthForLevel(stockfishLevel)}</span>
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-zinc-900 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={() => setShowLevelModal(false)}
            >
              {t("done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
