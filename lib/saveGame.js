import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { gameEndReason } from "./gameEndReason";

function makeFirestoreError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function serializeVerboseMoves(game) {
  return game.history({ verbose: true }).map((m) => {
    const o = {
      color: m.color,
      from: m.from,
      to: m.to,
      piece: m.piece,
      san: m.san,
      flags: m.flags,
    };
    if (m.captured) o.captured = m.captured;
    if (m.promotion) o.promotion = m.promotion;
    return o;
  });
}

/**
 * @param {{
 *   userId: string;
 *   game: import("chess.js").Chess;
 *   mode: string;
 *   result: string;
 *   timeControl: string;
 *   timeWinner?: "w"|"b"|null;
 *   initialSecondsWhite?: number | null;
 *   initialSecondsBlack?: number | null;
 *   stockfishLevel?: number | null;
 *   rated?: boolean;
 *   eloBefore?: number | null;
 *   eloAfter?: number | null;
 * }} params
 */
export async function saveFinishedGame({
  userId,
  game,
  mode,
  result,
  timeControl = "none",
  timeWinner = null,
  initialSecondsWhite = null,
  initialSecondsBlack = null,
  stockfishLevel = null,
  rated = false,
  eloBefore = null,
  eloAfter = null,
}) {
  const db = getFirebaseDb();
  if (!db) {
    throw makeFirestoreError("firestore/not-configured", "Firestore not configured");
  }
  if (!userId) {
    throw makeFirestoreError("firestore/missing-user", "Missing userId");
  }

  const reason = gameEndReason(game, timeWinner);
  const movesSan = game.history();
  const moveCount = movesSan.length;
  const movesVerbose = serializeVerboseMoves(game);

  try {
    await addDoc(collection(db, "chessGames"), {
      userId,
      pgn: game.pgn(),
      moves: movesVerbose,
      movesSan,
      moveCount,
      result,
      reason,
      mode,
      timeControl,
      initialSecondsWhite,
      initialSecondsBlack,
      stockfishLevel,
      rated,
      eloBefore,
      eloAfter,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("save chessGames failed", e);
    throw e;
  }

  // Update private user stats (best-effort).
  const statsUpdates = {
    "stats.gamesPlayed": increment(1),
    ...(result === "win"
      ? { "stats.wins": increment(1) }
      : result === "lose"
        ? { "stats.losses": increment(1) }
        : { "stats.draws": increment(1) }),
  };
  if (mode === "ai") {
    Object.assign(statsUpdates, {
      "stats.aiGames": increment(1),
      ...(result === "win"
        ? { "stats.aiWins": increment(1) }
        : result === "lose"
          ? { "stats.aiLosses": increment(1) }
          : { "stats.aiDraws": increment(1) }),
    });
  }
  try {
    await setDoc(
      doc(db, "users", userId),
      { ...statsUpdates, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    // Don't fail game save if stats update fails.
    console.error("update stats failed", e);
  }
}
