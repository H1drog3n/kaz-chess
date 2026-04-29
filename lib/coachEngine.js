/**
 * Heuristic move classification using Stockfish centipawn evaluations from White's POV.
 *
 * @typedef {{ kind: "cp"; cp: number } | { kind: "mate"; mate: number }} Eval
 */

/**
 * @param {Eval} ev
 */
export function evalToWhiteCp(ev) {
  if (!ev) return 0;
  if (ev.kind === "mate") {
    // Approximate mate scores as huge CP.
    const m = Math.abs(ev.mate);
    const sign = ev.mate > 0 ? 1 : -1;
    return sign * (100000 - m);
  }
  return Number(ev.cp) || 0;
}

/**
 * Loss from the perspective of the player who moved (positive means position got worse for mover).
 *
 * @param {Eval} evBefore
 * @param {Eval} evAfter
 * @param {"w"|"b"} mover
 */
export function moverLossCp(evBefore, evAfter, mover) {
  const before = evalToWhiteCp(evBefore);
  const after = evalToWhiteCp(evAfter);
  const whiteGain = after - before;
  const moverGain = mover === "w" ? whiteGain : -whiteGain;
  return -moverGain;
}

/**
 * Positive moverGain means the mover improved their position (centipawns).
 *
 * @param {number} moverGainCp
 */
export function classifyMoveFromMoverGain(moverGainCp) {
  const g = Number(moverGainCp) || 0;

  // Thresholds (centipawns). Tunable.
  if (g >= 140) return "brilliant";
  if (g >= 35) return "good";
  if (g >= -35) return "inaccuracy";
  if (g >= -120) return "mistake";
  return "blunder";
}
