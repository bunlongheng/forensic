import { guard } from "../wrap.js";

// GET /api/link-title?url=<stickies share url> -> { title, color } so a pasted
// Stickies link reads as the note's title in its folder color. The browser
// cannot fetch other sites (CSP connect-src 'self'), so the server asks the
// Stickies public note API. Only that host, only a note id: never an open proxy.
const STICKIES = "stickies-bheng.vercel.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function linkTitle(req, res) {
  if (!(await guard(req, res, { methods: ["GET"], limit: { key: "link-title", limit: 60, windowMs: 60000 } }))) return;
  let u;
  try { u = new URL(req.query?.url || ""); } catch { return res.status(400).json({ error: "Invalid url" }); }
  const id = u.searchParams.get("noteId") || u.searchParams.get("id") || "";
  if (u.protocol !== "https:" || u.hostname !== STICKIES || !UUID.test(id)) return res.status(400).json({ error: "Not a Stickies note link" });

  let title = null, color = null;
  try {
    const r = await fetch(`https://${STICKIES}/api/stickies/public?noteId=${id}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const j = await r.json();
      if (typeof j.title === "string" && j.title.trim()) title = j.title.trim().slice(0, 200);
      if (/^#[0-9a-f]{6}$/i.test(j.folder_color || "")) color = j.folder_color;
    }
  } catch { /* no title is fine: the card keeps its URL label */ }
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).json({ title, color });
}
