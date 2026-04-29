"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { getFirebaseDb } from "../lib/firebase";
import { depthForLevel } from "../lib/stockfishLevels";
import { updateUserSettings } from "../lib/profileDb";

function buildGameSearchParams({ mode, tc, minutes, level, rated }) {
  const sp = new URLSearchParams();
  sp.set("mode", mode);
  sp.set("tc", tc);
  if (tc === "custom") sp.set("min", String(minutes));
  if (mode === "ai") {
    sp.set("level", String(level));
    if (rated) sp.set("rated", "1");
  }
  return sp;
}

export function LobbyClient() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();

  const [mode, setMode] = useState("ai"); // ai | pvp
  const [tc, setTc] = useState("blitz180"); // none|bullet60|blitz180|rapid600|custom
  const [minutes, setMinutes] = useState(5);
  const [level, setLevel] = useState(6);
  const [rated, setRated] = useState(false);
  const [loadedDefaults, setLoadedDefaults] = useState(false);

  const tcOptions = useMemo(
    () => [
      { key: "none", label: "No timer" },
      { key: "bullet60", label: "Bullet 1+0" },
      { key: "blitz180", label: "Blitz 3+0" },
      { key: "rapid600", label: "Rapid 10+0" },
      { key: "custom", label: "Custom" },
    ],
    []
  );

  useEffect(() => {
    if (!user || loadedDefaults) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (!snap.exists()) return;
        const s = snap.data()?.settings || {};
        if (s.defaultMode === "ai" || s.defaultMode === "pvp") setMode(s.defaultMode);
        if (typeof s.defaultTimeControl === "string") setTc(s.defaultTimeControl);
        if (Number.isFinite(s.defaultCustomMinutes)) setMinutes(Math.min(120, Math.max(1, s.defaultCustomMinutes)));
        if (Number.isFinite(s.defaultStockfishLevel)) setLevel(Math.min(9, Math.max(1, s.defaultStockfishLevel)));
        if (typeof s.ratedDefault === "boolean") setRated(s.ratedDefault);
      })
      .finally(() => setLoadedDefaults(true));
  }, [user, loadedDefaults]);

  const startGame = () => {
    const sp = buildGameSearchParams({ mode, tc, minutes, level, rated });
    if (user) {
      // Best-effort persistence of defaults; never block starting a game.
      updateUserSettings(user.uid, {
        defaultMode: mode,
        defaultTimeControl: tc,
        defaultCustomMinutes: minutes,
        defaultStockfishLevel: level,
        ratedDefault: rated,
      }).catch(console.error);
    }
    router.push(`/game?${sp.toString()}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10">
      <div className="mb-8 w-full text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("lobby_title")}
        </h1>
        <p className="mx-auto max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t("lobby_desc")}
        </p>
      </div>

      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t("match_settings")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("home_tip_moves")}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 underline dark:text-blue-400"
          >
            ← {t("main_menu")}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {t("mode")}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "ai"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                }`}
              >
                {t("mode_ai")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("pvp");
                  setRated(false);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === "pvp"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                }`}
              >
                {t("mode_pvp")}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {t("you_play_white")}
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {t("time")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tcOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setTc(o.key)}
                  className={`rounded-lg px-3 py-2 text-left text-sm ${
                    tc === o.key
                      ? "bg-emerald-600 text-white"
                      : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                  }`}
                >
                  {o.key === "none"
                    ? t("no_timer")
                    : o.key === "custom"
                      ? t("custom")
                      : o.label}
                </button>
              ))}
            </div>
            {tc === "custom" && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{t("minutes")}</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value) || 5)}
                  className="w-24 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            )}
          </div>

          {mode === "ai" && (
            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {t("stockfish_strength")}
              </div>
              <input
                type="range"
                min={1}
                max={9}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) || 6)}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-sm text-zinc-700 dark:text-zinc-300">
                <span>
                  Level <span className="font-semibold">{level}</span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  depth {depthForLevel(level)}
                </span>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rated}
                  onChange={(e) => setRated(e.target.checked)}
                  className="rounded"
                />
                {t("rated_hint")}
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={startGame}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-500"
        >
          {t("lobby_cta")}
        </button>
        <Link
          href="/multiplayer"
          className="mt-3 block w-full rounded-xl border border-zinc-300 px-6 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Мультиплеер: игра с другом по ссылке
        </Link>
      </section>

      <p className="mt-6 text-center text-xs text-zinc-500">
        {t("lobby_footer")}
      </p>
    </main>
  );
}

