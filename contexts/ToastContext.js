"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { safeSessionStorageGet, safeSessionStorageRemove, safeSessionStorageSet } from "../lib/clientStorage";

const PENDING_TOAST_KEY = "__kaz_chess_pending_toast";

const ToastContext = createContext({
  toast: /** @type {(message: string, opts?: { type?: "success"|"error"|"info", durationMs?: number }) => void} */ (
    () => {}
  ),
  success: /** @type {(message: string, opts?: { durationMs?: number }) => void} */ (
    () => {}
  ),
  error: /** @type {(message: string, opts?: { durationMs?: number }) => void} */ (
    () => {}
  ),
  info: /** @type {(message: string, opts?: { durationMs?: number }) => void} */ (
    () => {}
  ),
});

function Toast({ t, onClose }) {
  const base =
    "pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur";
  const styles =
    t.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-50"
      : t.type === "error"
        ? "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-50"
        : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <div className={`${base} ${styles}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">{t.message}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs opacity-70 hover:opacity-100"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) window.clearTimeout(tm);
    timersRef.current.delete(id);
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const t = {
        id,
        message: String(message || ""),
        type: opts.type || "info",
      };
      setToasts((ts) => [...ts, t].slice(-3));
      const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 3500;
      const tm = window.setTimeout(() => remove(id), durationMs);
      timersRef.current.set(id, tm);
    },
    [remove]
  );

  const success = useCallback(
    (message, opts = {}) => toast(message, { ...opts, type: "success" }),
    [toast]
  );
  const error = useCallback(
    (message, opts = {}) => toast(message, { ...opts, type: "error" }),
    [toast]
  );
  const info = useCallback(
    (message, opts = {}) => toast(message, { ...opts, type: "info" }),
    [toast]
  );

  useEffect(() => {
    try {
      const raw = safeSessionStorageGet(PENDING_TOAST_KEY);
      if (!raw) return;
      safeSessionStorageRemove(PENDING_TOAST_KEY);
      const parsed = JSON.parse(raw);
      if (parsed?.message) toast(parsed.message, parsed.opts || {});
    } catch {
      // ignore
    }
  }, [toast]);

  const value = useMemo(() => ({ toast, success, error, info }), [toast, success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[calc(100vw-2rem)] flex-col gap-2 sm:w-auto">
        {toasts.map((t) => (
          <Toast key={t.id} t={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function setPendingToast(message, opts) {
  if (typeof window === "undefined") return;
  try {
    safeSessionStorageSet(PENDING_TOAST_KEY, JSON.stringify({ message, opts }));
  } catch {
    // ignore
  }
}

