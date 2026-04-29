export function safeLocalStorageGet(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeLocalStorageSet(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function safeSessionStorageGet(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.sessionStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function safeSessionStorageSet(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function safeSessionStorageRemove(key) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

