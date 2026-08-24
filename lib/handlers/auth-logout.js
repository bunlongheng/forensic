import { cookie, appOrigin } from "../auth-session.js";

// POST /api/auth/logout -> clear the session cookie.
export default async function authLogout(req, res) {
  const { secure } = appOrigin(req);
  res.setHeader("Set-Cookie", cookie("fx_session", "", { maxAge: 0, secure }));
  return res.status(200).json({ ok: true });
}
