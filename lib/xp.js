export function levelFromXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  return Math.floor(x / 250) + 1;
}
