/** Result for the human playing White vs AI (Black). */
export function resultForWhitePlayer(game, timeWinner = null) {
  if (timeWinner === "w") return "win";
  if (timeWinner === "b") return "lose";
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "lose" : "win";
  }
  return "draw";
}

/** PvP: result from White's perspective (same shape as vs AI for storage). */
export function resultForWhitePvp(game, timeWinner) {
  if (timeWinner === "w") return "win";
  if (timeWinner === "b") return "lose";
  if (game.isCheckmate()) return game.turn() === "w" ? "lose" : "win";
  return "draw";
}
