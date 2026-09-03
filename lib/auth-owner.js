import crypto from "crypto";
import { isLocal } from "./is-local.js";
import { verifySession, readCookie, appOrigin, sessionCookieName } from "./auth-session.js";

// True when the request carries a valid owner session cookie (Google sign-in).
function sessionOwner(req) {
  const OWNER = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!OWNER) return false;
  const { secure } = appOrigin(req);
  const s = verifySession(readCookie(req, sessionCookieName(secure)));
  return Boolean(s && s.email && s.email.toLowerCase() === OWNER);
}

// Constant-time Bearer check against FORENSIC_API_SECRET. Length is
// checked FIRST so timingSafeEqual (which throws on length mismatch) is never
// allowed to throw. The secret lives ONLY in server env - never NEXT_PUBLIC_*,
// never referenced in a client component.
export function bearerOk(req) {
  const secret = process.env.FORENSIC_API_SECRET;
  if (!secret) return false;
  const header = (req && req.headers && req.headers["authorization"]) || "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Order of checks:
//   1. isLocal (dev/LAN bypass, gated OFF in prod)
//   2. Bearer FORENSIC_API_SECRET  (skipped when allowBearer:false)
//   3. Google owner session cookie (fx_session, set by /api/auth/callback)
// The Bearer key is scoped to POST /api/ai/boards only - every other owner
// route (list/read-own, update, delete, POST /api/boards) requires isLocal or
// the owner's signed-in session.
export async function authorizeOwner(req, opts = {}) {
  const { allowBearer = true } = opts;
  if (isLocal(req)) return true;
  if (allowBearer && bearerOk(req)) return true;
  // Google owner-email session (sign-in). This is what lets the logged-in owner
  // use admin-only routes (allowBearer:false) in prod - those routes still
  // reject the public Bearer key, but accept the owner's session.
  if (sessionOwner(req)) {
    // CSRF defense in depth: the cookie alone is not proof of intent (a
    // cross-site form/fetch would carry it too). For any state-changing method,
    // also require same-site fetch metadata OR a same-origin Origin header.
    const method = (req.method || "GET").toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
    const secFetchSite = req.headers && req.headers["sec-fetch-site"];
    if (secFetchSite === "same-origin" || secFetchSite === "none") return true;
    const origin = req.headers && req.headers.origin;
    if (origin && origin === appOrigin(req).origin) return true;
    return false;
  }
  return false;
}

// The DB user_id used for the owner's rows (the legacy owner UUID, shared with
// the sibling apps). Fail-closed if unset.
export function ownerId() {
  return process.env.OWNER_USER_ID?.trim() || null;
}
