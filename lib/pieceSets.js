export const PIECE_SETS = {
  classic: {
    id: "classic",
    priceCoins: 0,
    name: { ru: "Классика", en: "Classic" },
  },
  neon: {
    id: "neon",
    priceCoins: 250,
    name: { ru: "Неон", en: "Neon" },
  },
  marble: {
    id: "marble",
    priceCoins: 500,
    name: { ru: "Мрамор", en: "Marble" },
  },
  wood: {
    id: "wood",
    priceCoins: 750,
    name: { ru: "Дерево", en: "Wood" },
  },
};

export function listPieceSets() {
  return Object.values(PIECE_SETS);
}
