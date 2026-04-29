import fs from "fs";
import path from "path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../lib/firebaseAdmin.js";
import { QUIZ_BASICS_1 } from "../lib/learn/quizBasics1.js";

/**
 * Node CLI scripts do not load `.env.local` automatically (unlike `next dev`).
 * Minimal parser so `FIREBASE_SERVICE_ACCOUNT_JSON_FILE=...` works for seeds.
 */
function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\n/g, "\n");
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnvLocal();
getFirebaseAdminApp();
const db = getFirestore();

const lessons = [
  {
    id: "welcome-1",
    title: { ru: "Добро пожаловать в KAZ CHESS", en: "Welcome to KAZ CHESS" },
    rewardCoins: 10,
    rewardXp: 10,
    order: 10,
  },
  {
    id: "study-plan-1",
    title: { ru: "Как пользоваться разделом Обучение", en: "How to use Learning" },
    rewardCoins: 0,
    rewardXp: 0,
    order: 20,
  },
];

const quizzes = [QUIZ_BASICS_1];

async function main() {
  for (const lesson of lessons) {
    const ref = db.collection("lessons").doc(lesson.id);
    await ref.set(
      {
        title: lesson.title,
        rewardCoins: lesson.rewardCoins,
        rewardXp: lesson.rewardXp,
        order: lesson.order,
        isPublished: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("Seeded lesson:", lesson.id);
  }

  for (const qz of quizzes) {
    const ref = db.collection("quizzes").doc(qz.id);
    await ref.set(
      {
        title: qz.title,
        rewardCoins: qz.rewardCoins,
        rewardXp: qz.rewardXp,
        isPublished: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const batch = db.batch();
    for (const q of qz.questions) {
      batch.set(ref.collection("questions").doc(q.id), q, { merge: true });
    }
    await batch.commit();
    console.log("Seeded quiz:", qz.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
