import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp;

function loadServiceAccountJsonString() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline && String(inline).trim()) {
    return String(inline).trim();
  }

  const fileEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_FILE ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (fileEnv && String(fileEnv).trim()) {
    const abs = path.isAbsolute(fileEnv)
      ? fileEnv
      : path.join(process.cwd(), fileEnv);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON_FILE points to missing file: ${abs}`
      );
    }
    return fs.readFileSync(abs, "utf8");
  }

  throw new Error(
    [
      "Missing Firebase Admin credentials.",
      "Set FIREBASE_SERVICE_ACCOUNT_JSON (single-line JSON string),",
      "or FIREBASE_SERVICE_ACCOUNT_JSON_FILE=/absolute/or/project-relative/path/to/key.json",
      "",
      "Tip: multi-line JSON inside .env.local often fails dotenv parsing — use ONE line JSON or a separate .json file.",
    ].join(" ")
  );
}

export function getFirebaseAdminApp() {
  if (adminApp) return adminApp;

  const json = loadServiceAccountJsonString();

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "Invalid Firebase Admin JSON (must be valid JSON). If it is truncated, fix .env formatting or use FIREBASE_SERVICE_ACCOUNT_JSON_FILE."
    );
  }

  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert(parsed),
    });
  } else {
    adminApp = getApps()[0];
  }

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
