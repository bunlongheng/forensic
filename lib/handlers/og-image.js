import sharp from "sharp";
import db from "../db.js";
import { guard } from "../wrap.js";
import { UUID } from "../share.js";

// GET /api/og-image?id=<uuid> -> the board's own snapshot (the gallery
// thumbnail, a real capture of the canvas) fitted into the 1200x630 frame every
// unfurler crops to. Not a redrawing: the pins, torn notes and red threads the
// recipient will see are exactly what the card shows. The bars around the
// capture take the canvas colour from its own corner pixel, so the letterbox
// reads as more corkboard, not a frame. JPEG because the capture is WebP and
// LinkedIn / iMessage / X only take JPEG, PNG or GIF.
const W = 1200;
const H = 630;
const PAD = 36;
const DATA_URL = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/]+=*)$/;

export async function renderCard(thumbnail) {
  const m = DATA_URL.exec(thumbnail);
  if (!m) return null;
  const src = Buffer.from(m[2], "base64");
  const corner = await sharp(src).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2] };
  // The capture is a wide 2.6:1 strip of a board that is usually taller than
  // wide, so most of it is empty cork. Trim that first, or the board sits as a
  // small cluster in the middle of the card instead of filling it.
  let content = src;
  try { content = await sharp(src).trim({ background, threshold: 24 }).toBuffer(); } catch { /* flat capture: keep it whole */ }
  return sharp(content)
    .resize(W - PAD * 2, H - PAD * 2, { fit: "contain", background })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background })
    .flatten({ background })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

export default async function ogImage(req, res) {
  if (!(await guard(req, res, { methods: ["GET"], limit: { key: "og-image", limit: 120, windowMs: 60000 } }))) return;
  const id = (req.query && req.query.id) || "";
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid id" });

  const { rows } = await db.query("SELECT thumbnail FROM boards WHERE id = $1 AND trashed_at IS NULL", [id]);
  const jpeg = rows.length && rows[0].thumbnail ? await renderCard(rows[0].thumbnail) : null;
  if (!jpeg) {
    // No snapshot yet (never saved, or empty): the site card stands in.
    res.statusCode = 302;
    res.setHeader("Location", "/og.png");
    res.setHeader("Cache-Control", "no-store");
    return res.end();
  }
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", String(jpeg.length));
  // The URL carries a hash of the snapshot (see og.js), so a card can sit in
  // caches for a day: a new capture is a new URL.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).send(jpeg);
}
