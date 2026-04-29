const FILES = "abcdefgh";
const RANKS = "87654321";

/** @param {import("chess.js").Chess} game */
export function findKingSquare(game, color) {
  for (const r of RANKS) {
    for (const f of FILES) {
      const sq = `${f}${r}`;
      const p = game.get(sq);
      if (p && p.type === "k" && p.color === color) return sq;
    }
  }
  return null;
}

/** @param {import("chess.js").Chess} game @param {string} fromSquare */
export function getLegalTargetSquares(game, fromSquare) {
  try {
    return game
      .moves({ square: fromSquare, verbose: true })
      .map((m) => m.to);
  } catch {
    return [];
  }
}

/**
 * Legal moves from a square (verbose), for capture vs quiet highlighting.
 * @param {import("chess.js").Chess} game
 * @param {string} fromSquare
 */
export function getLegalMovesVerboseFromSquare(game, fromSquare) {
  try {
    return game.moves({ square: fromSquare, verbose: true });
  } catch {
    return [];
  }
}
