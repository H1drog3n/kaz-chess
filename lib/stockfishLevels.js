/** Stockfish UCI depth per UI level (1 = weakest, 9 = strongest). */
export const STOCKFISH_LEVEL_DEPTH = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 7,
  6: 10,
  7: 12,
  8: 15,
  9: 20,
};

export function depthForLevel(level) {
  const n = Math.min(9, Math.max(1, Number(level) || 6));
  return STOCKFISH_LEVEL_DEPTH[n];
}
