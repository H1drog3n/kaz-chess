"use client";

import Link from "next/link";
import { useLocale } from "../contexts/LocaleContext";

export default function HomePage() {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-14 text-center">
      <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        {t("home_title")}
      </h1>
      <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
        {t("home_desc")}
      </p>

      <div className="mb-10 flex w-full max-w-md flex-col gap-3">
        <Link
          href="/lobby"
          className="rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-500"
        >
          {t("home_play")}
        </Link>
        <Link
          href="/history"
          className="rounded-xl border border-zinc-300 bg-white px-6 py-4 text-lg font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {t("home_history")}
        </Link>
        <Link
          href="/profile"
          className="rounded-xl border border-zinc-300 bg-white px-6 py-4 text-lg font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {t("home_settings")}
        </Link>
        <Link
          href="/shop"
          className="rounded-xl border border-zinc-300 bg-white px-6 py-4 text-lg font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {t("home_shop")}
        </Link>
      </div>

      <p className="text-sm text-zinc-500">
        {t("home_tip_moves")}
      </p>
    </main>
  );
}
