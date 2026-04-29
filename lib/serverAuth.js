import { getAdminAuth } from "./firebaseAdmin";

export async function requireUidFromRequest(req) {
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) {
    const err = new Error("Unauthorized");
    err.code = "unauthorized";
    throw err;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch (e) {
    console.warn("verifyIdToken:", e?.message || e);
    const err = new Error("Unauthorized");
    err.code = "unauthorized";
    throw err;
  }
}
