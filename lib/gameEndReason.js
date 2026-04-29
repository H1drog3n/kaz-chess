/**
 * Derive a human + machine friendly end reason.
 * @param {import("chess.js").Chess} game
 * @param {"w"|"b"|null} timeWinner
 * @returns {"checkmate"|"stalemate"|"repetition"|"insufficient"|"fifty-move"|"time"|"unknown"}
 */
export function gameEndReason(game, timeWinner = null) {
  if (timeWinner) return "time";
  if (game.isCheckmate()) return "checkmate";
  if (game.isStalemate()) return "stalemate";
  // chess.js draw helpers
  if (game.isThreefoldRepetition?.() && game.isThreefoldRepetition()) return "repetition";
  if (game.isInsufficientMaterial?.() && game.isInsufficientMaterial()) return "insufficient";
  if (game.isDraw?.() && game.isDraw()) return "fifty-move";
  return "unknown";
}

