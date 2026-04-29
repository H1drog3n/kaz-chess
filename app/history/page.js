"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { labelForMode, labelForReason } from "../../lib/gameLabels";
import { useLocale } from "../../contexts/LocaleContext";

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { locale, t } = useLocale();
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const db = getFirebaseDb();
    if (!db || !user) return;
    setFetching(true);
    setError(null);
    try {
      const q = query(
        collection(db, "chessGames"),
        where("userId", "==", user.uid),
        limit(50)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setRows(list);
    } catch (e) {
      setError(e?.message || "Failed to load games");
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user, load]);

  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-zinc-600 dark:text-zinc-400">
        {t("loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          {locale === "en"
            ? "Log in to see your saved games."
            : "Войдите, чтобы увидеть сохранённые партии."}
        </p>
        <Link
          href="/game"
          className="text-blue-600 underline dark:text-blue-400"
        >
          {t("home_play")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("history_title")}</h1>
        <button
          type="button"
          onClick={load}
          disabled={fetching}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {fetching ? t("refreshing") : t("refresh")}
        </button>
      </div>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {rows.length === 0 && !fetching && (
        <p className="text-zinc-600 dark:text-zinc-400">{t("no_games")}</p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
                {r.result || "—"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {r.createdAt?.toDate
                    ? r.createdAt.toDate().toLocaleString()
                    : ""}
                </span>
                <Link
                  href={`/history/${r.id}`}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                >
                  {t("details")}
                </Link>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {r.mode && <span>{t("mode")}: {labelForMode(r.mode, locale)}</span>}
              {r.timeControl && <span>{t("time")}: {String(r.timeControl)}</span>}
              {r.stockfishLevel != null && <span>AI: {r.stockfishLevel}</span>}
              {r.reason && <span>{t("reason")}: {labelForReason(r.reason, locale)}</span>}
              {r.rated && <span className="font-semibold text-emerald-700 dark:text-emerald-400">Rated</span>}
            </div>
            {(Number.isFinite(r.moveCount) || (Array.isArray(r.moves) && r.moves.length > 0)) && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {t("moves")}: {Number.isFinite(r.moveCount) ? r.moveCount : r.moves.length}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center">
        <Link href="/game" className="text-blue-600 underline dark:text-blue-400">
          {t("home_play")}
        </Link>
      </p>
    </div>
  );
}
