const DEFAULT_ELO = 1200;
const K = 32;

/** Expected score for player A. */
function expected(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * @param {number} humanElo player (white) rating
 * @param {number} engineElo synthetic opponent rating by level 800 + level*150
 * @param {number} score 1 win 0.5 draw 0 loss from human POV
 */
export function nextElo(humanElo, engineElo, score) {
  const e = expected(humanElo, engineElo);
  return Math.round(humanElo + K * (score - e));
}

export function engineRatingForLevel(level) {
  const l = Math.min(9, Math.max(1, level));
  return 700 + l * 140;
}

export { DEFAULT_ELO };
