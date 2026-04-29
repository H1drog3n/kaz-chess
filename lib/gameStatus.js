/**
 * @param {import("chess.js").Chess} game
 * @param {"w"|"b"|null} timeWinner
 */
export function getGameStatus(game, timeWinner = null, locale = "ru") {
  const ru = locale !== "en";
  if (timeWinner === "w") {
    return {
      label: ru ? "Игра окончена" : "Game over",
      detail: ru ? "Белые выиграли по времени" : "White wins on time",
    };
  }
  if (timeWinner === "b") {
    return {
      label: ru ? "Игра окончена" : "Game over",
      detail: ru ? "Чёрные выиграли по времени" : "Black wins on time",
    };
  }
  if (game.isCheckmate()) {
    return {
      label: ru ? "МАТ — Игра окончена" : "CHECKMATE — Game Over",
      detail: ru
        ? `${game.turn() === "w" ? "Чёрные" : "Белые"} выиграли`
        : `${game.turn() === "w" ? "Black" : "White"} wins`,
    };
  }
  if (game.isStalemate()) {
    return {
      label: ru ? "ПАТ — Ничья" : "Stalemate — Draw",
      detail: ru ? "Игра окончена" : "Game over",
    };
  }
  if (game.isDraw()) {
    if (game.isThreefoldRepetition()) {
      return {
        label: ru ? "НИЧЬЯ — Игра окончена" : "Draw — Game Over",
        detail: ru ? "Троекратное повторение" : "Threefold repetition",
      };
    }
    if (game.isInsufficientMaterial()) {
      return {
        label: ru ? "НИЧЬЯ — Игра окончена" : "Draw — Game Over",
        detail: ru ? "Недостаточно материала" : "Insufficient material",
      };
    }
    return {
      label: ru ? "НИЧЬЯ — Игра окончена" : "Draw — Game Over",
      detail: ru ? "Правило 50 ходов" : "Fifty-move rule",
    };
  }
  if (game.isCheck()) {
    return {
      label: ru ? "ШАХ" : "CHECK",
      detail: ru
        ? `Ходят ${game.turn() === "w" ? "белые" : "чёрные"}`
        : `${game.turn() === "w" ? "White" : "Black"} to move`,
    };
  }
  return {
    label: ru ? "Игра идёт" : "Playing",
    detail: ru
      ? `Ходят ${game.turn() === "w" ? "белые" : "чёрные"}`
      : `${game.turn() === "w" ? "White" : "Black"} to move`,
  };
}
