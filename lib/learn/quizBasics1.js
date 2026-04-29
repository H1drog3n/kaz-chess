/**
 * Единый источник для квиза basics-1: демо без БД, сид и серверная проверка ответов.
 */
export const QUIZ_BASICS_1 = {
  id: "basics-1",
  title: {
    ru: "База: как ходят фигуры",
    en: "Basics: how pieces move",
  },
  rewardCoins: 2000,
  rewardXp: 100,
  questions: [
    {
      id: "q1",
      prompt: {
        ru: "Как ходит конь?",
        en: "How does a knight move?",
      },
      options: [
        { id: "a", text: { ru: "Буквой Г", en: "In an L-shape" } },
        { id: "b", text: { ru: "Только вперёд", en: "Only forward" } },
        {
          id: "c",
          text: {
            ru: "По диагонали любое число клеток",
            en: "Diagonally any distance",
          },
        },
      ],
      correctOptionId: "a",
      explanation: {
        ru: "Конь ходит буквой Г: на 2 клетки по прямой и на 1 в сторону.",
        en: "A knight moves in an L-shape: two squares in one direction, then one sideways.",
      },
    },
    {
      id: "q2",
      prompt: {
        ru: "Что такое рокировка?",
        en: "What is castling?",
      },
      options: [
        {
          id: "a",
          text: {
            ru: "Король и ладья делают специальный ход",
            en: "King and rook special move",
          },
        },
        { id: "b", text: { ru: "Пешка доходит до края", en: "Pawn promotion" } },
        { id: "c", text: { ru: "Взятие на проходе", en: "En passant" } },
      ],
      correctOptionId: "a",
      explanation: {
        ru: "Рокировка — специальный ход короля и ладьи для безопасности короля.",
        en: "Castling is a special king+rook move mainly for king safety.",
      },
    },
    {
      id: "q3",
      prompt: {
        ru: "Сколько полей может пройти ладья за один ход?",
        en: "How far can a rook move in one move?",
      },
      options: [
        {
          id: "a",
          text: {
            ru: "Любое число по вертикали/горизонтали",
            en: "Any distance along ranks/files",
          },
        },
        { id: "b", text: { ru: "Только на 1 клетку", en: "Only one square" } },
        { id: "c", text: { ru: "Только по диагонали", en: "Only diagonally" } },
      ],
      correctOptionId: "a",
      explanation: {
        ru: "Ладья ходит по прямым линиям на любое число клеток (если нет препятствий).",
        en: "A rook slides along ranks/files any distance if unobstructed.",
      },
    },
  ],
};
