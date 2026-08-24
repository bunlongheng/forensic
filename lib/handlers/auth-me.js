import { verifySession, readCookie } from "../auth-session.js";

// GET /api/auth/me -> { authenticated, email? } from the signed session cookie.
export default async function authMe(req, res) {
  const s = verifySession(readCookie(req, "fx_session"));
  const OWNER = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (s && OWNER && s.email && s.email.toLowerCase() === OWNER) {
    return res.status(200).json({ authenticated: true, email: s.email });
  }
  return res.status(200).json({ authenticated: false });
}
