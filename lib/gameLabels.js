export function labelForReason(reason, locale = "ru") {
  const ru = locale !== "en";
  switch (reason) {
    case "checkmate":
      return ru ? "Мат" : "Checkmate";
    case "stalemate":
      return ru ? "Пат" : "Stalemate";
    case "repetition":
      return ru ? "Троекратное повторение" : "Threefold repetition";
    case "insufficient":
      return ru ? "Недостаточно материала" : "Insufficient material";
    case "fifty-move":
      return ru ? "Правило 50 ходов" : "Fifty-move rule";
    case "time":
      return ru ? "Время" : "Time";
    default:
      return ru ? "Игра окончена" : "Game over";
  }
}

export function labelForMode(mode, locale = "ru") {
  const ru = locale !== "en";
  if (mode === "ai") return ru ? "Против AI" : "vs AI";
  if (mode === "pvp") return ru ? "Локально (2 игрока)" : "Local PvP";
  return String(mode || "—");
}

