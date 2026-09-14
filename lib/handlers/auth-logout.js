import { cookie, appOrigin, sessionCookieName } from "../auth-session.js";

// POST /api/auth/logout -> clear the session cookie.
// The method guard matters: Vercel routes every method to the same function, so
// without it a plain GET cleared the cookie. Any <img src=".../api/auth/logout">
// on any page on the internet would then sign the owner out.
export default async function authLogout(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { secure } = appOrigin(req);
  res.setHeader("Set-Cookie", cookie(sessionCookieName(secure), "", { maxAge: 0, secure }));
  return res.status(200).json({ ok: true });
}
