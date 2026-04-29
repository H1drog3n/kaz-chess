"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useLocale } from "../../contexts/LocaleContext";
import { BOARD_THEMES, coerceBoardTheme } from "../../lib/boardThemes";
import { friendlyAuthError } from "../../lib/authErrors";
import { getFirebaseDb } from "../../lib/firebase";
import { DEFAULT_ELO } from "../../lib/elo";
import { updateUserSettings } from "../../lib/profileDb";
import { safeLocalStorageGet, safeLocalStorageSet } from "../../lib/clientStorage";
import { listPieceSets, PIECE_SETS } from "../../lib/pieceSets";

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { user, loading, signOutUser, firebaseEnabled } = useAuth();
  const toast = useToast();
  const { locale, t } = useLocale();
  const [profile, setProfile] = useState(null);
  const [boardTheme, setBoardTheme] = useState("classic");
  const [activePieceSet, setActivePieceSet] = useState("classic");
  const [unlockedPieceSets, setUnlockedPieceSets] = useState(["classic"]);
  const [isElite, setIsElite] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [eliteDevBusy, setEliteDevBusy] = useState(false);

  const showEliteDevToggle =
    typeof process.env.NEXT_PUBLIC_ELITE_DEV_TOGGLE === "string" &&
    process.env.NEXT_PUBLIC_ELITE_DEV_TOGGLE === "true";

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwErr, setPwErr] = useState(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const pieceSets = useMemo(() => listPieceSets(), []);

  useEffect(() => {
    const v = safeLocalStorageGet("boardTheme", "classic");
    setBoardTheme(coerceBoardTheme(v));
    const ps = safeLocalStorageGet("pieceSet", "classic");
    if (typeof ps === "string") setActivePieceSet(ps);
  }, []);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      setProfile(data);
      setIsElite(Boolean(data?.premium?.isElite));
      const ap = data?.cosmetics?.activePieceSet;
      const un = data?.cosmetics?.unlockedPieceSets;
      if (typeof ap === "string") setActivePieceSet(ap);
      if (Array.isArray(un)) setUnlockedPieceSets(un);
      const bt = data?.settings?.boardTheme;
      if (typeof bt === "string") setBoardTheme(coerceBoardTheme(bt));
    });
  }, [user]);

  async function startEliteCheckout() {
    if (!user) {
      toast.error(t("coach_no_auth"));
      return;
    }
    try {
      setStripeBusy(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        const err = data?.error || "stripe_error";
        const detail = typeof data?.detail === "string" ? data.detail : "";
        const map = {
          firebase_admin_not_configured: t("server_not_configured"),
          stripe_not_configured: t("stripe_not_configured"),
          stripe_invalid_price: t("stripe_invalid_price"),
          stripe_api_error: t("stripe_api_error_hint"),
          unauthorized: t("coach_no_auth"),
          server_error: t("quiz_server_error"),
        };
        let msg = map[err] ?? t("elite_checkout_failed");
        if (detail) msg = `${msg} ${detail}`;
        toast.error(msg);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      toast.error(t("elite_checkout_failed"));
    } finally {
      setStripeBusy(false);
    }
  }

  async function setEliteDevFlag(on) {
    if (!user) return;
    try {
      setEliteDevBusy(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/profile/setEliteFlag", {
        method: "POST",
        headers: {
          authorization: `Bearer ${idToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ elite: on }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "elite_dev_toggle_disabled") {
          toast.error(t("elite_dev_toggle_disabled"));
        } else if (data?.error === "firebase_admin_not_configured") {
          toast.error(t("server_not_configured"));
        } else {
          toast.error(t("quiz_server_error"));
        }
        return;
      }
      const next = Boolean(data.isElite);
      setIsElite(next);
      setProfile((p) =>
        p
          ? {
              ...p,
              premium: { ...p.premium, isElite: next },
            }
          : p
      );
      toast.success(t("elite_dev_saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("quiz_server_error"));
    } finally {
      setEliteDevBusy(false);
    }
  }

  function pieceName(setKey) {
    const meta = PIECE_SETS[setKey]?.name || {};
    return locale === "en" ? meta.en || meta.ru || setKey : meta.ru || meta.en || setKey;
  }

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-zinc-500">{t("loading")}</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          {locale === "en" ? "Log in to open your profile." : "Войдите, чтобы открыть профиль."}
        </p>
        <Link href="/login" className="text-blue-600 underline">
          {t("login_button")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("account_page_title")}</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">{t("username")}</p>
        <p className="mb-4 text-lg font-medium">
          {profile?.username || user.displayName || "—"}
        </p>
        <p className="text-sm text-zinc-500">{t("email")}</p>
        <p className="mb-4">{profile?.email || user.email || "—"}</p>
        <p className="text-sm text-zinc-500">User ID</p>
        <p className="mb-4 break-all font-mono text-xs">{user.uid}</p>
        <p className="text-sm text-zinc-500">
          {locale === "en" ? "Elo (rated vs AI)" : "Elo (рейтинг против AI)"}
        </p>
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {profile?.elo ?? DEFAULT_ELO}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
            <div className="text-xs text-zinc-500">{t("coins")}</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {profile?.economy?.coins ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
            <div className="text-xs text-zinc-500">{t("xp")}</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {profile?.progress?.xp ?? 0}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
            <div className="text-xs text-zinc-500">{t("level")}</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {profile?.progress?.level ?? 1}
            </div>
          </div>
        </div>
        {profile?.stats && (
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
              <div className="text-xs text-zinc-500">Партии</div>
              <div className="text-lg font-semibold">
                {profile.stats.gamesPlayed ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
              <div className="text-xs text-zinc-500">П / Пор / Н</div>
              <div className="text-lg font-semibold">
                {(profile.stats.wins ?? 0) +
                  " / " +
                  (profile.stats.losses ?? 0) +
                  " / " +
                  (profile.stats.draws ?? 0)}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
              <div className="text-xs text-zinc-500">Партии vs AI</div>
              <div className="text-lg font-semibold">
                {profile.stats.aiGames ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/40">
              <div className="text-xs text-zinc-500">vs AI: П / Пор / Н</div>
              <div className="text-lg font-semibold">
                {(profile.stats.aiWins ?? 0) +
                  " / " +
                  (profile.stats.aiLosses ?? 0) +
                  " / " +
                  (profile.stats.aiDraws ?? 0)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">{t("elite_title")}</p>
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">{t("elite_desc")}</p>
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {t("elite_unlimited_ai")}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("elite_price_caption")}
        </p>
        <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {(typeof process.env.NEXT_PUBLIC_ELITE_PRICE_LABEL === "string" &&
          process.env.NEXT_PUBLIC_ELITE_PRICE_LABEL.trim()
            ? process.env.NEXT_PUBLIC_ELITE_PRICE_LABEL.trim()
            : t("elite_price_default"))}
        </p>
        {isElite ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
            {t("elite_subscription_active")}
          </p>
        ) : (
          <button
            type="button"
            onClick={startEliteCheckout}
            disabled={stripeBusy}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {stripeBusy ? t("refreshing") : t("elite_buy")}
          </button>
        )}
        <p className="mt-3 text-xs text-zinc-500">{t("elite_pay_secure_hint")}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <span className="text-zinc-700 dark:text-zinc-300">{t("coach_elite")}</span>
          <span className="font-semibold">{isElite ? t("elite_on") : t("elite_off")}</span>
        </div>
      </div>

      {showEliteDevToggle && (
        <div className="mt-4 rounded-xl border border-dashed border-amber-400/80 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/30">
          <p className="mb-1 text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t("elite_dev_panel_title")}
          </p>
          <p className="mb-3 text-xs text-amber-900/90 dark:text-amber-200/90">
            {t("elite_dev_panel_hint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={eliteDevBusy || isElite}
              onClick={() => setEliteDevFlag(true)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t("elite_dev_on")}
            </button>
            <button
              type="button"
              disabled={eliteDevBusy || !isElite}
              onClick={() => setEliteDevFlag(false)}
              className="rounded-lg border border-amber-700 bg-white px-4 py-2 text-sm font-semibold text-amber-950 disabled:opacity-40 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100"
            >
              {t("elite_dev_off")}
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        {t("interface_prefs_heading")}
      </h2>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">{t("appearance")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              theme === "light"
                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            {t("theme_light")}
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              theme === "dark"
                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            {t("theme_dark")}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">{t("board_theme")}</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BOARD_THEMES).map(([key, th]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setBoardTheme(key);
                safeLocalStorageSet("boardTheme", key);
                if (user) {
                  updateUserSettings(user.uid, { boardTheme: key }).catch(console.error);
                }
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                boardTheme === key
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-zinc-300 dark:border-zinc-600"
              }`}
            >
              <div className="font-medium">{th.name}</div>
              <div className="mt-1 flex gap-2">
                <span
                  className="h-4 w-4 rounded-sm border border-black/10"
                  style={{ background: th.light }}
                />
                <span
                  className="h-4 w-4 rounded-sm border border-black/10"
                  style={{ background: th.dark }}
                />
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t("applied_in_game")}</p>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 font-medium text-zinc-800 dark:text-zinc-200">{t("piece_skin")}</p>
        <div className="grid grid-cols-2 gap-2">
          {pieceSets.map((ps) => {
            const locked = !unlockedPieceSets.includes(ps.id);
            return (
              <button
                key={ps.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  setActivePieceSet(ps.id);
                  safeLocalStorageSet("pieceSet", ps.id);
                  if (user) {
                    updateUserSettings(user.uid, { activePieceSet: ps.id }).catch(console.error);
                  }
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  activePieceSet === ps.id
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-300 dark:border-zinc-600"
                } ${locked ? "opacity-40" : ""}`}
              >
                <div className="font-medium">{pieceName(ps.id)}</div>
                <div className="text-xs text-zinc-500">
                  {locked ? t("piece_locked") : t("owned")}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t("unlock_skins_hint")}</p>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        {t("profile_security")}
      </h2>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPwErr(null);
            if (!firebaseEnabled || !user) return;
            if (!newPassword || newPassword.length < 6) {
              setPwErr(t("password_min"));
              return;
            }
            if (newPassword !== confirmNewPassword) {
              setPwErr(t("passwords_no_match"));
              return;
            }
            try {
              setPwSubmitting(true);
              await updatePassword(user, newPassword);
              setNewPassword("");
              setConfirmNewPassword("");
              toast.success(t("password_updated"));
            } catch (er) {
              setPwErr(
                er?.code === "auth/requires-recent-login"
                  ? t("relogin_required")
                  : friendlyAuthError(er)
              );
            } finally {
              setPwSubmitting(false);
            }
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            minLength={6}
            autoComplete="new-password"
            placeholder={t("new_password")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
          <input
            type="password"
            minLength={6}
            autoComplete="new-password"
            placeholder={t("confirm_new_password")}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
          {pwErr && (
            <p className="text-sm text-red-600 dark:text-red-400">{pwErr}</p>
          )}
          <button
            type="submit"
            disabled={pwSubmitting || !firebaseEnabled}
            className="rounded-lg bg-zinc-900 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pwSubmitting ? t("refreshing") : t("change_password")}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            await signOutUser();
            toast.info(t("toast_logged_out"));
          }}
          className="mt-4 w-full rounded-lg border border-zinc-300 py-2 font-medium dark:border-zinc-600"
        >
          {t("logout")}
        </button>
      </div>

      <p className="mt-8 text-center">
        <Link href="/" className="text-zinc-500 underline">
          {t("back_home")}
        </Link>
      </p>
    </div>
  );
}
