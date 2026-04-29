"use client";

import { makeClassicPalettePieces } from "./classicBurnettPieces";

/**
 * Custom piece renderers for shop skins.
 * Neon / marble / wood: Staunton silhouettes (same geometry as classic board), custom palettes only.
 */
export function makeCustomPieces(setKey) {
  if (!setKey || setKey === "classic") return undefined;

  const classicStyled = makeClassicPalettePieces(setKey);
  if (classicStyled) return classicStyled;

  return undefined;
}
