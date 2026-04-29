"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { setPendingToast } from "../../contexts/ToastContext";
import { friendlyAuthError } from "../../lib/authErrors";
import { useLocale } from "../../contexts/LocaleContext";

export default function SignupPage() {
  const { user, signUpWithEmail, signInWithGoogle, firebaseEnabled, loading } =
    useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    try {
      const em = email.trim();
      if (!em || !password) {
        setErr(t("invalid_credentials"));
        return;
      }
      if (password !== confirmPassword) {
        setErr(t("passwords_no_match"));
        return;
      }
      setSubmitting(true);
      await signUpWithEmail(em, password, username);
      setPendingToast(t("toast_account_created"), { type: "success" });
      toast.success(t("toast_account_created"));
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
      setPendingToast(t("toast_account_created"), { type: "success" });
      toast.success(t("toast_account_created"));
      router.replace("/");
    } catch (er) {
      setErr(friendlyAuthError(er));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("signup_title")}</h1>
      {!firebaseEnabled && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          {t("firebase_env_hint")}
        </p>
      )}
      <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-3">
        <input
          type="text"
          required
          minLength={2}
          placeholder={t("username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
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
          minLength={6}
          autoComplete="new-password"
          placeholder={t("new_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder={t("confirm_password")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {submitting ? t("creating") : t("signup_button")}
        </button>
      </form>
      <button
        type="button"
        disabled={loading || submitting || !firebaseEnabled}
        onClick={onGoogle}
        className="mb-6 w-full rounded-lg border border-zinc-300 py-2 font-medium dark:border-zinc-600"
      >
        {t("google_signup")}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-blue-600 underline dark:text-blue-400">
          {t("have_account")}
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
