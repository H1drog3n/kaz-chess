import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "./firebaseAdmin";
import { DEFAULT_ELO } from "./elo";

/**
 * Гарантирует наличие users/{uid} для серверных транзакций (Admin SDK),
 * если клиентский syncUserProfile не успел или не сработал.
 * @param {string} uid
 */
export async function ensureServerUser(uid) {
  if (!uid) return;

  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return;

  let email = "";
  let displayName = "";
  try {
    const au = await getAdminAuth().getUser(uid);
    email = au.email || "";
    displayName = au.displayName || "";
  } catch {
    // без профиля Auth всё равно создаём минимальный документ
  }

  const username = displayName || (email ? email.split("@")[0] : "player");

  await ref.set(
    {
      userId: uid,
      email,
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
          periodStart: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db
    .collection("publicUsers")
    .doc(uid)
    .set(
      {
        userId: uid,
        username,
        elo: DEFAULT_ELO,
        xp: 0,
        level: 1,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
