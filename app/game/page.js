import { ChessGameClient } from "../../components/game/ChessGameClient";

export const metadata = {
  title: "Play — KAZ CHESS",
};

function coercePlayMode(v) {
  return v === "ai" || v === "pvp" ? v : "pvp";
}

function coerceTc(v) {
  const allowed = new Set(["none", "bullet60", "blitz180", "rapid600", "custom"]);
  return allowed.has(v) ? v : "none";
}

function coerceInt(v, { min, max, fallback }) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function coerceBool(v) {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export default function GamePage({ searchParams }) {
  const playMode = coercePlayMode(searchParams?.mode);
  const timeControlKey = coerceTc(searchParams?.tc);
  const customMinutes = coerceInt(searchParams?.min, {
    min: 1,
    max: 120,
    fallback: 5,
  });
  const stockfishLevel = coerceInt(searchParams?.level, {
    min: 1,
    max: 9,
    fallback: 6,
  });
  const rated = playMode === "ai" ? coerceBool(searchParams?.rated) : false;

  return (
    <ChessGameClient
      initialPlayMode={playMode}
      initialTimeControlKey={timeControlKey}
      initialCustomMinutes={customMinutes}
      initialStockfishLevel={stockfishLevel}
      initialRated={rated}
      hideSetup
    />
  );
}
