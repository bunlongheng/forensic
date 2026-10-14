import sharp from "sharp";
import db from "../db.js";
import { guard } from "../wrap.js";
import { appOrigin } from "../auth-session.js";
import { verifyPasscode, unlockToken, unlockCookieName } from "../passcode.js";
import { gatePage } from "../passcode-pages.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET  /api/boards/:id/unlock -> the lock screen (the app sends a visitor here
//                                when the board answers 401 passcode_required).
// POST /api/boards/:id/unlock -> check the passcode; right sets a 30-day unlock
//                                cookie and goes back to /?id=...&reveal=1,
//                                wrong redraws the lock screen.
async function load(id) {
  const { rows } = await db.query(
    "SELECT id, title, passcode_hash, thumbnail FROM boards WHERE id = $1 AND trashed_at IS NULL",
    [id],
  );
  return rows[0] || null;
}

// The board behind the lock screen, as an 80 px wide PNG: nothing in it can be
// read, and the page blurs it further. Only this thumbnail ever leaves the
// server; null (a plain wash) if there is none or it cannot be decoded.
async function backdrop(row) {
  const m = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(row.thumbnail || "");
  if (!m) return null;
  try {
    const png = await sharp(Buffer.from(m[1], "base64")).resize({ width: 80 }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

function html(res, body, status = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  return res.end(body);
}

function redirect(res, status, location) {
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  return res.end();
}

export default async function unlock(req, res) {
  const id = (req.query && req.query.id) || (req.params && req.params.id) || null;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid id" });

  const back = `/?id=${id}`;
  const action = `/api/boards/${id}/unlock`;

  if (req.method === "GET") {
    if (!(await guard(req, res, { methods: ["GET", "POST"], limit: { key: "unlock-page", limit: 60, windowMs: 60000 } }))) return;
    const row = await load(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!row.passcode_hash) return redirect(res, 302, back);
    return html(res, gatePage({ action, title: row.title || "Locked board", backdrop: await backdrop(row) }));
  }

  // Before the DB hit and the deliberately slow scrypt: 10 guesses / 5 min.
  if (!(await guard(req, res, { methods: ["GET", "POST"], limit: { key: "unlock", limit: 10, windowMs: 300000 } }))) return;
  const row = await load(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (!row.passcode_hash) return redirect(res, 303, back);

  // Express hands over an object (express.urlencoded), Vercel too for a form
  // post; a raw string is parsed as a urlencoded body.
  const raw = typeof req.body === "string" ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
  const passcode = String(raw.passcode ?? "").trim().toLowerCase();
  if (!(await verifyPasscode(passcode, row.passcode_hash))) {
    return html(res, gatePage({ action, title: row.title || "Locked board", bad: true, backdrop: await backdrop(row) }), 401);
  }
  // Straight on to the board, which plays the reveal (src/components/UnlockReveal.jsx).
  const secure = appOrigin(req).secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${unlockCookieName(id)}=${unlockToken(id, row.passcode_hash)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`);
  return redirect(res, 303, `${back}&reveal=1`);
}
