import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";
import { levelFromXp } from "./xp";

function safeNonNegInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.round(x);
}

function isBadMap(val) {
  return (
    val !== undefined &&
    val !== null &&
    (typeof val !== "object" || Array.isArray(val))
  );
}

/**
 * Если economy или progress имеют неверный тип (например число вместо map),
 * merge с объектом в транзакции даёт INVALID_ARGUMENT.
 * Чистим поля и записываем корректную форму.
 * @param {string} uid
 */
export async function repairEconomyProgressShape(uid) {
  if (!uid) return;

  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return;

  const d = snap.data() || {};
  const econ = d.economy;
  const prog = d.progress;

  const badEcon = isBadMap(econ);
  const badProg = isBadMap(prog);

  if (!badEcon && !badProg) return;

  let coinsSeed = 0;
  if (badEcon) {
    if (typeof econ === "number") coinsSeed = safeNonNegInt(econ);
    else if (econ && typeof econ === "object" && !Array.isArray(econ)) {
      coinsSeed = safeNonNegInt(econ.coins);
    }
  }

  let xpSeed = 0;
  let lvlSeed = 1;
  if (badProg) {
    if (typeof prog === "number") xpSeed = safeNonNegInt(prog);
    else if (prog && typeof prog === "object" && !Array.isArray(prog)) {
      xpSeed = safeNonNegInt(prog.xp);
      const lv = safeNonNegInt(prog.level);
      lvlSeed = lv > 0 ? lv : levelFromXp(xpSeed);
    }
  }

  const deletes = {};
  if (badEcon) deletes.economy = FieldValue.delete();
  if (badProg) deletes.progress = FieldValue.delete();

  if (Object.keys(deletes).length) await ref.update(deletes);

  const patch = {};
  if (badEcon) patch.economy = { coins: coinsSeed };
  if (badProg) {
    patch.progress = {
      xp: xpSeed,
      level: lvlSeed || levelFromXp(xpSeed),
    };
  }

  if (Object.keys(patch).length) await ref.set(patch, { merge: true });
}
