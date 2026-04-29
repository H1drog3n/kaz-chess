"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { setPendingToast } from "../../contexts/ToastContext";
import { friendlyAuthError } from "../../lib/authErrors";
import { useLocale } from "../../contexts/LocaleContext";

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, sendPasswordReset, firebaseEnabled, loading } =
    useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    try {
      if (!email.trim() || !password) {
        setErr(t("invalid_credentials"));
        return;
      }
      setSubmitting(true);
      await signInWithEmail(email.trim(), password);
      setPendingToast(t("toast_login_success"), { type: "success" });
      toast.success(t("toast_login_success"));
      router.replace("/");
    } catch (er) {
      setErr(friendlyAuthError(er));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    try {
      setSubmitting(true);
      await signInWithGoogle();
      setPendingToast(t("toast_login_success"), { type: "success" });
      toast.success(t("toast_login_success"));
      router.replace("/");
    } catch (er) {
      setErr(friendlyAuthError(er));
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setErr(null);
    const em = resetEmail.trim();
    if (!em) return;
    try {
      setResetSubmitting(true);
      await sendPasswordReset(em);
      toast.success(t("reset_sent"));
      setResetOpen(false);
      setResetEmail("");
    } catch {
      toast.success(t("reset_sent"));
      setResetOpen(false);
      setResetEmail("");
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("login_title")}</h1>
      {!firebaseEnabled && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          {t("firebase_env_hint")}{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code>.
        </p>
      )}
      <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={t("password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
        {err && (
          <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
        )}
        <button
          type="submit"
          disabled={loading || submitting || !firebaseEnabled}
          className="rounded-lg bg-zinc-900 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? t("signing_in") : t("login_button")}
        </button>
      </form>
      <button
        type="button"
        disabled={loading || submitting || !firebaseEnabled}
        onClick={onGoogle}
        className="mb-6 w-full rounded-lg border border-zinc-300 py-2 font-medium dark:border-zinc-600"
      >
        {t("google_login")}
      </button>

      <button
        type="button"
        disabled={loading || submitting || !firebaseEnabled}
        onClick={() => setResetOpen((v) => !v)}
        className="mb-8 w-full text-sm text-blue-600 underline disabled:opacity-50 dark:text-blue-400"
      >
        {t("forgot_password")}
      </button>

      {resetOpen && (
        <form onSubmit={onReset} className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 text-sm font-semibold">{t("reset_password_title")}</div>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t("email")}
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={resetSubmitting || !firebaseEnabled}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {resetSubmitting ? t("sending") : t("send_reset_link")}
          </button>
          <p className="mt-2 text-xs text-zinc-500">
            {t("reset_email_hint")}
          </p>
        </form>
      )}
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t("no_account")}{" "}
        <Link href="/signup" className="text-blue-600 underline dark:text-blue-400">
          {t("link_signup")}
        </Link>
      </p>
      <p className="mt-6 text-center">
        <Link href="/" className="text-sm text-zinc-500 underline">
          {t("back_home")}
        </Link>
      </p>
    </div>
  );
}
