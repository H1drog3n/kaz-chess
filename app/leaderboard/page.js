"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import { useLocale } from "../../contexts/LocaleContext";

export default function LeaderboardPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState("elo"); // elo | students
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const desc = useMemo(
    () => (tab === "elo" ? t("leaderboard_desc") : t("students_leaderboard_desc")),
    [tab, t]
  );

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const q =
      tab === "elo"
        ? query(collection(db, "publicUsers"), orderBy("elo", "desc"), limit(50))
        : query(collection(db, "publicUsers"), orderBy("xp", "desc"), limit(50));

    getDocs(q)
      .then((snap) => {
        setRows(snap.docs.map((d) => d.data()));
      })
      .catch((e) => {
        setErr(e?.message || "Failed to load leaderboard");
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-3 text-2xl font-semibold">{t("leaderboard_title")}</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("elo")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === "elo"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          }`}
        >
          {t("leaderboard_tab_elo")}
        </button>
        <button
          type="button"
          onClick={() => setTab("students")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === "students"
              ? "bg-emerald-600 text-white"
              : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          }`}
        >
          {t("leaderboard_tab_students")}
        </button>
      </div>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">{desc}</p>

      {loading && (
        <p className="text-zinc-600 dark:text-zinc-400">{t("loading")}</p>
      )}
      {err && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}
      {!loading && !err && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div
            className={`grid gap-2 border-b border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-800 ${
              tab === "elo"
                ? "grid-cols-[70px_1fr_90px]"
                : "grid-cols-[70px_1fr_70px_70px]"
            }`}
          >
            <div>#</div>
            <div>{t("player")}</div>
            {tab === "elo" ? (
              <div className="text-right">Elo</div>
            ) : (
              <>
                <div className="text-right">{t("xp")}</div>
                <div className="text-right">{t("level")}</div>
              </>
            )}
          </div>
          {rows.map((r, idx) => (
            <div
              key={r.userId || idx}
              className={`grid gap-2 border-b border-zinc-100 px-4 py-3 text-sm last:border-b-0 dark:border-zinc-800 ${
                tab === "elo"
                  ? "grid-cols-[70px_1fr_90px]"
                  : "grid-cols-[70px_1fr_70px_70px]"
              }`}
            >
              <div className="text-zinc-500">#{idx + 1}</div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                {r.username || t("player")}
              </div>
              {tab === "elo" ? (
                <div className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                  {Number.isFinite(r.elo) ? r.elo : "—"}
                </div>
              ) : (
                <>
                  <div className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {Number.isFinite(r.xp) ? r.xp : "—"}
                  </div>
                  <div className="text-right font-semibold text-zinc-800 dark:text-zinc-200">
                    {Number.isFinite(r.level) ? r.level : "—"}
                  </div>
                </>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
              {t("no_players")}
            </div>
          )}
        </div>
      )}

      <Link href="/" className="mt-6 inline-block text-blue-600 underline dark:text-blue-400">
        {t("back_home")}
      </Link>
    </div>
  );
}

