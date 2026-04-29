"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useLocale } from "../contexts/LocaleContext";
import { friendlyAuthError } from "../lib/authErrors";
import { setPendingToast } from "../contexts/ToastContext";

function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { user, loading, firebaseEnabled, signInWithGoogle, signOutUser } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { locale, toggleLocale, t } = useLocale();

  const finishAuth = async (message, type, fn) => {
    try {
      await fn();
      setPendingToast(message, { type });
      toast[type](message);
      router.push("/");
    } catch (e) {
      toast.error(friendlyAuthError(e));
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          KAZ CHESS
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
          <NavLink href="/lobby">{t("nav_play")}</NavLink>
          <NavLink href="/history">{t("nav_history")}</NavLink>
          <NavLink href="/learn">{t("nav_learn")}</NavLink>
          <NavLink href="/leaderboard">{t("nav_rating")}</NavLink>
          <NavLink href="/shop">{t("nav_shop")}</NavLink>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
            title="Language"
            onClick={toggleLocale}
          >
            {locale.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? t("theme_light") : t("theme_dark")}
          </button>
          {!firebaseEnabled && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("firebase_not_configured")}
            </span>
          )}
          {!user && (
            <>
              <NavLink href="/login">{t("nav_login")}</NavLink>
              {firebaseEnabled && !loading && (
                <button
                  type="button"
                  onClick={() =>
                    finishAuth(t("toast_login_success"), "success", signInWithGoogle)
                  }
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Google
                </button>
              )}
            </>
          )}
          {user && (
            <>
              <NavLink href="/profile">{t("nav_profile")}</NavLink>
              <span className="hidden max-w-[120px] truncate text-sm text-zinc-600 dark:text-zinc-400 sm:inline">
                {user.displayName || user.email}
              </span>
              {firebaseEnabled && (
                <button
                  type="button"
                  onClick={() =>
                    finishAuth(t("toast_logged_out"), "info", signOutUser)
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {t("nav_logout")}
                </button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
