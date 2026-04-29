"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useLocale } from "../../contexts/LocaleContext";
import { useToast } from "../../contexts/ToastContext";
import { getFirebaseDb } from "../../lib/firebase";
import { listPieceSets, PIECE_SETS } from "../../lib/pieceSets";

export default function ShopPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const toast = useToast();
  const [coins, setCoins] = useState(null);
  const [xp, setXp] = useState(null);
  const [level, setLevel] = useState(null);

  const sets = useMemo(() => listPieceSets(), []);

  useEffect(() => {
    if (!user) {
      setCoins(null);
      setXp(null);
      setLevel(null);
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      setCoins(d?.economy?.coins ?? 0);
      setXp(d?.progress?.xp ?? 0);
      setLevel(d?.progress?.level ?? 1);
    });
  }, [user]);

  async function buy(setId) {
    if (!user) {
      toast.error(t("coach_no_auth"));
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/shop/purchasePieceSet", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ setId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "firebase_admin_not_configured") {
          toast.error(t("server_not_configured"));
          return;
        }
        if (data?.error === "not_enough_coins") {
          toast.error(t("not_enough_coins"));
          return;
        }
        throw new Error(data?.error || "error");
      }
      if (data.alreadyOwned) {
        toast.info(t("already_owned"));
      } else {
        toast.success(t("purchased"));
        if (typeof data.newBalance === "number") setCoins(data.newBalance);
      }
    } catch (e) {
      console.error(e);
      toast.error(t("shop_purchase_failed"));
    }
  }

  function name(setKey) {
    const meta = PIECE_SETS[setKey]?.name || {};
    return locale === "en" ? meta.en || meta.ru || setKey : meta.ru || meta.en || setKey;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {user && coins != null && (
        <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span>
            <span className="text-zinc-500">{t("coins")}: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{coins}</span>
          </span>
          <span className="text-zinc-400">·</span>
          <span>
            <span className="text-zinc-500">{t("xp")}: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{xp ?? 0}</span>
          </span>
          <span className="text-zinc-400">·</span>
          <span>
            <span className="text-zinc-500">{t("level")}: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{level ?? 1}</span>
          </span>
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">{t("shop_title")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{t("shop_desc")}</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">
          {t("back_home")}
        </Link>
      </div>

      <div className="space-y-3">
        {sets.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name(s.id)}</div>
              <div className="text-xs text-zinc-500">
                {t("price")}: {s.priceCoins} {t("coins")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => buy(s.id)}
              disabled={s.priceCoins === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {s.priceCoins === 0 ? t("owned") : t("buy")}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-zinc-500">
        {t("shop_tip")}
      </p>
    </div>
  );
}
