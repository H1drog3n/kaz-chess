import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { DEFAULT_ELO } from "./elo";
import { levelFromXp } from "./xp";

/**
 * @param {import("firebase/auth").User} user
 * @param {{ username?: string }} [extra]
 */
export async function syncUserProfile(user, extra = {}) {
  const db = getFirebaseDb();
  if (!db || !user) return;

  const ref = doc(db, "users", user.uid);
  const publicRef = doc(db, "publicUsers", user.uid);
  const snap = await getDoc(ref);
  const username =
    extra.username ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "player");

  if (!snap.exists()) {
    await setDoc(ref, {
      userId: user.uid,
      email: user.email || "",
      username,
      elo: DEFAULT_ELO,
      economy: { coins: 0 },
      progress: { xp: 0, level: 1 },
      cosmetics: {
        unlockedPieceSets: ["classic"],
        activePieceSet: "classic",
      },
      coach: {
        monthlyQuota: {
          freeAnalysesUsed: 0,
          periodStart: serverTimestamp(),
        },
      },
      premium: { isElite: false },
      settings: {
        boardTheme: "classic",
        defaultMode: "ai",
        defaultTimeControl: "blitz180",
        defaultCustomMinutes: 5,
        defaultStockfishLevel: 6,
        ratedDefault: false,
      },
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        aiGames: 0,
        aiWins: 0,
        aiLosses: 0,
        aiDraws: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(
      ref,
      {
        email: user.email || snap.data()?.email || "",
        username: snap.data()?.username || username,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  const mergedSnap = await getDoc(ref);
  const merged = mergedSnap.exists() ? mergedSnap.data() : {};

  // Backfill new fields for older accounts (safe defaults).
  const backfill = {};
  if (merged?.economy?.coins == null) backfill["economy.coins"] = 0;
  if (merged?.progress?.xp == null) backfill["progress.xp"] = 0;
  if (merged?.progress?.level == null) {
    backfill["progress.level"] = levelFromXp(merged?.progress?.xp ?? 0);
  }
  if (!Array.isArray(merged?.cosmetics?.unlockedPieceSets)) {
    backfill["cosmetics.unlockedPieceSets"] = ["classic"];
  }
  if (!merged?.cosmetics?.activePieceSet) {
    backfill["cosmetics.activePieceSet"] = "classic";
  }
  if (!merged?.coach?.monthlyQuota) {
    backfill["coach.monthlyQuota.freeAnalysesUsed"] = 0;
    backfill["coach.monthlyQuota.periodStart"] = serverTimestamp();
  }
  if (merged?.premium?.isElite == null) {
    backfill["premium.isElite"] = false;
  }

  if (Object.keys(backfill).length) {
    backfill.updatedAt = serverTimestamp();
    await setDoc(ref, backfill, { merge: true });
  }

  const mergedSnap2 = await getDoc(ref);
  const merged2 = mergedSnap2.exists() ? mergedSnap2.data() : {};
  const xp = merged2?.progress?.xp ?? 0;
  const lvl = levelFromXp(xp);

  // Public leaderboard view: no email, safe to read publicly.
  await setDoc(
    publicRef,
    {
      userId: user.uid,
      username,
      elo: merged?.elo ?? DEFAULT_ELO,
      xp,
      level: lvl,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

/**
 * Persist user settings defaults (best-effort).
 * @param {string} userId
 * @param {Partial<{boardTheme:string, defaultMode:string, defaultTimeControl:string, defaultCustomMinutes:number, defaultStockfishLevel:number, ratedDefault:boolean, activePieceSet:string}>} settings
 */
export async function updateUserSettings(userId, settings) {
  const db = getFirebaseDb();
  if (!db || !userId || !settings) return;

  const patch = {};
  for (const [k, v] of Object.entries(settings)) {
    if (k === "activePieceSet") {
      patch[`cosmetics.${k}`] = v;
    } else {
      patch[`settings.${k}`] = v;
    }
  }
  patch.updatedAt = serverTimestamp();

  try {
    await updateDoc(doc(db, "users", userId), patch);
  } catch (e) {
    // If document doesn't exist yet, fall back to setDoc merge.
    await setDoc(doc(db, "users", userId), patch, { merge: true });
  }
}

export async function updateUserElo(userId, newElo) {
  const db = getFirebaseDb();
  if (!db) return;
  await setDoc(
    doc(db, "users", userId),
    { elo: newElo, updatedAt: serverTimestamp() },
    { merge: true }
  );
  const u = await getDoc(doc(db, "users", userId));
  const xp = u.exists() ? u.data()?.progress?.xp ?? 0 : 0;
  const lvl = levelFromXp(xp);
  await setDoc(
    doc(db, "publicUsers", userId),
    { elo: newElo, xp, level: lvl, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
