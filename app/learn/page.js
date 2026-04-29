"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useLocale } from "../../contexts/LocaleContext";
import { useToast } from "../../contexts/ToastContext";
import { getFirebaseDb } from "../../lib/firebase";
import { QUIZ_BASICS_1 } from "../../lib/learn/quizBasics1";

export default function LearnPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const toast = useToast();

  /** Если в Firestore ещё нет квизов — показываем тот же basics-1 офлайн и начисляем через API. */
  const embeddedBasicsQuiz = useMemo(
    () => ({ ...QUIZ_BASICS_1, _embeddedQuestions: true }),
    []
  );

  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);

  const [activeQuizId, setActiveQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    Promise.all([
      getDocs(query(collection(db, "lessons"), where("isPublished", "==", true))),
      getDocs(query(collection(db, "quizzes"), where("isPublished", "==", true))),
    ])
      .then(([lessonsSnap, quizzesSnap]) => {
        const ls = lessonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        ls.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
        setLessons(ls);

        const qs = quizzesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // If Firestore is empty (or not seeded yet), show a built-in demo quiz
        // so the page is never "empty" without explanation.
        setQuizzes(qs.length ? qs : [embeddedBasicsQuiz]);
      })
      .catch((e) => {
        console.error(e);
        setLoadErr(e?.message || "Failed to load learning content");
      })
      .finally(() => setLoading(false));
  }, [embeddedBasicsQuiz]);

  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId) || null,
    [quizzes, activeQuizId]
  );

  async function openQuiz(quizId) {
    setActiveQuizId(quizId);
    setAnswers({});
    setQuestions([]);
    const meta = quizzes.find((q) => q.id === quizId);
    if (meta?._embeddedQuestions && meta.questions?.length) {
      setQuestions(meta.questions);
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;
    const qs = await getDocs(collection(db, "quizzes", quizId, "questions"));
    const list = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    setQuestions(list);
  }

  async function submitQuiz() {
    if (!user) {
      toast.error(t("coach_no_auth"));
      return;
    }
    if (!activeQuizId) return;
    try {
      setSubmitting(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/learn/submitQuiz", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ quizId: activeQuizId, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = String(data?.error || "server_error");
        const map = {
          firebase_admin_not_configured: t("server_not_configured"),
          unauthorized: t("coach_no_auth"),
          not_found: t("quiz_not_found"),
          profile_missing: t("quiz_profile_missing"),
          invalid_payload: t("quiz_submit_failed"),
          server_error: t("quiz_server_error"),
          firestore_api_disabled: t("firestore_api_disabled"),
        };
        let msg = map[code] ?? t("quiz_submit_failed");
        if (data?.detail) msg = `${msg}: ${data.detail}`;
        toast.error(msg);
        return;
      }

      toast.success(
        `${t("quiz_result")}: ${data.score}/${data.maxScore} · +${data.earnedCoins} ${t(
          "coins"
        )} · +${data.earnedXp} XP`
      );
      setActiveQuizId(null);
      setQuestions([]);
      setAnswers({});
    } catch (e) {
      console.error(e);
      toast.error(t("quiz_submit_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function titleForQuiz(q) {
    const tr = q.title || {};
    return locale === "en" ? tr.en || tr.ru || q.id : tr.ru || tr.en || q.id;
  }

  function titleForLesson(l) {
    const tr = l.title || {};
    return locale === "en" ? tr.en || tr.ru || l.id : tr.ru || tr.en || l.id;
  }

  function textFor(field, fallback = "") {
    if (!field) return fallback;
    return locale === "en" ? field.en || field.ru || fallback : field.ru || field.en || fallback;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">{t("learn_hub_title")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{t("learn_hub_desc")}</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">
          {t("back_home")}
        </Link>
      </div>

      {loading && <p className="text-zinc-600 dark:text-zinc-400">{t("loading")}</p>}

      {!loading && loadErr && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t("learn_load_failed")}: {loadErr}
        </p>
      )}

      {!loading && !activeQuiz && (
        <div className="space-y-3">
          {lessons.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">{t("lessons_heading")}</h2>
              <div className="space-y-3">
                {lessons.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {titleForLesson(l)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        +{l.rewardCoins ?? 0} {t("coins")} · +{l.rewardXp ?? 0} XP
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-500 dark:border-zinc-700"
                      title={t("lesson_soon")}
                    >
                      {t("lesson_soon")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="mb-3 text-lg font-semibold">{t("quizzes_heading")}</h2>

          {quizzes.length === 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">
              {t("quizzes_empty")}
            </p>
          )}
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{titleForQuiz(q)}</div>
                <div className="text-xs text-zinc-500">
                  +{q.rewardCoins ?? 0} {t("coins")} · +{q.rewardXp ?? 0} XP
                </div>
              </div>
              <button
                type="button"
                onClick={() => openQuiz(q.id)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t("start_quiz")}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeQuiz && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="font-semibold">{titleForQuiz(activeQuiz)}</div>
            <button
              type="button"
              className="text-sm text-zinc-600 underline dark:text-zinc-400"
              onClick={() => {
                setActiveQuizId(null);
                setQuestions([]);
                setAnswers({});
              }}
            >
              {t("back_to_list")}
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 font-medium">{textFor(q.prompt)}</div>
                <div className="space-y-2">
                  {(q.options || []).map((opt) => (
                    <label key={opt.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        checked={answers[q.id] === opt.id}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                      />
                      <span>{textFor(opt.text)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={submitting || questions.length === 0}
            onClick={submitQuiz}
            className="mt-6 w-full rounded-xl bg-zinc-900 py-3 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? t("refreshing") : t("submit_quiz")}
          </button>
        </div>
      )}
    </div>
  );
}
