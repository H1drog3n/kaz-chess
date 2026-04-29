import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured() {
  const c = readConfig();
  return Boolean(c.apiKey && c.projectId && c.authDomain);
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  const config = readConfig();
  if (getApps().length) return getApp();
  return initializeApp(config);
}

/** Call only on the client (e.g. from React effects or event handlers). */
export function getFirebaseAuth() {
  if (typeof window === "undefined") return null;
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

export function getFirebaseDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}
