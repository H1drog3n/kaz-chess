"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../lib/firebase";
import { syncUserProfile } from "../lib/profileDb";

const AuthContext = createContext({
  user: null,
  loading: true,
  firebaseEnabled: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendPasswordReset: async () => {},
  signOutUser: async () => {},
});

function makeAuthError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const firebaseEnabled = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Auth persistence:", err);
    });
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await syncUserProfile(u);
        } catch (e) {
          console.error("syncUserProfile", e);
        }
      }
      setLoading(false);
    });
  }, [firebaseEnabled]);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw makeAuthError(
        "auth/not-configured",
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* keys to .env.local."
      );
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    setUser(cred.user);
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    const auth = getFirebaseAuth();
    if (!auth) throw makeAuthError("auth/not-configured", "Firebase not configured");

    // Best-effort differentiation: some Firebase settings prevent method enumeration.
    let emailExists = null;
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      emailExists = Boolean(methods?.length);
    } catch (e) {
      console.warn("fetchSignInMethodsForEmail:", e);
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
    } catch (err) {
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password") {
        throw err;
      }
      if (
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/invalid-login-credentials"
      ) {
        if (emailExists === true) throw makeAuthError("auth/wrong-password", "Incorrect password");
        throw makeAuthError("auth/invalid-credential", "Invalid credentials");
      }
      throw err;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email, password, username) => {
    const auth = getFirebaseAuth();
    if (!auth) throw makeAuthError("auth/not-configured", "Firebase not configured");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    setUser(cred.user);
    if (username?.trim()) {
      await updateProfile(cred.user, { displayName: username.trim() });
    }
    // Firestore profile sync should not block signup success.
    try {
      await syncUserProfile(cred.user, { username: username?.trim() });
    } catch (e) {
      console.error("syncUserProfile (signup)", e);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const auth = getFirebaseAuth();
    if (!auth) throw makeAuthError("auth/not-configured", "Firebase not configured");

    // Security: don't leak whether the email exists. Still, only send if it is registered.
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods?.length) {
        await sendPasswordResetEmail(auth, email);
      }
    } catch (e) {
      // Intentionally swallow to avoid leaking registration state.
      console.warn("sendPasswordReset:", e);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      firebaseEnabled,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOutUser,
    }),
    [
      user,
      loading,
      firebaseEnabled,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOutUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
