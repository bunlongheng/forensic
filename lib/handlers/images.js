import db from "../db.js";
import { authorizeOwner, ownerId } from "../auth-owner.js";
import { rateLimit } from "../rate-limit.js";

// One image per row, referenced from a board node as /api/images/<id>.
//
// POST /api/images  -> owner-only upload of ONE image. Its own request, so a board
//                      with 50 photos never builds a single oversized body.
// GET  /api/images/:id -> public read, same as a board: a shared ?id= link has to
//                      render its photos, and these bytes were already public when
//                      they lived inline in the publicly-readable board JSON.
//
// Bytes arrive as a data URL in JSON rather than multipart: the client already
// produces one (canvas.toDataURL), Vercel's function runtime hands us a parsed
// JSON body for free, and it keeps this endpoint dependency-free.

// Only what an <img> can actually render, and what the ingest pipeline produces.
const ALLOWED = new Set(["image/webp", "image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/avif"]);

// Comfortably under Vercel's 4.5 MB request cap, with room for base64's 33%
// overhead and the JSON envelope: 3 MB of raw bytes is ~4.1 MB on the wire.
export const IMAGE_MAX_BYTES = 3_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "data:image/webp;base64,AAAA" -> { mime, buf }. Returns null for anything that
// is not a base64 data URL of an allowed image type.
export function parseDataUrl(src) {
  if (typeof src !== "string") return null;
  const m = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(src);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!ALLOWED.has(mime)) return null;
  try {
    const buf = Buffer.from(m[2], "base64");
    return buf.length ? { mime, buf } : null;
  } catch {
    return null;
  }
}

export async function createImage(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const limited = rateLimit(req, { key: "image-write", limit: 120, windowMs: 60000 });
  if (!limited.ok) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  if (!(await authorizeOwner(req))) return res.status(401).json({ error: "Unauthorized" });

  const parsed = parseDataUrl(req.body && req.body.src);
  if (!parsed) return res.status(400).json({ error: "src must be a base64 data URL of a supported image type" });
  if (parsed.buf.length > IMAGE_MAX_BYTES) {
    return res.status(413).json({ error: `Image too large (max ${Math.round(IMAGE_MAX_BYTES / 1e6)} MB)` });
  }

  const { rows } = await db.query(
    "INSERT INTO board_images (user_id, mime, bytes, byte_size) VALUES ($1, $2, $3, $4) RETURNING id",
    [ownerId() || "owner", parsed.mime, parsed.buf, parsed.buf.length],
  );
  return res.status(201).json({ id: rows[0].id, url: `/api/images/${rows[0].id}`, size: parsed.buf.length });
}

export async function getImage(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const id = (req.query && req.query.id) || (req.params && req.params.id) || null;
  if (!id || !UUID.test(id)) return res.status(400).json({ error: "Invalid id" });

  const { rows } = await db.query("SELECT mime, bytes FROM board_images WHERE id = $1", [id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });

  const { mime, bytes } = rows[0];
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(bytes.length));
  // An image row is never rewritten - a change produces a new id - so it can be
  // cached forever. This is what keeps a 50-photo board cheap to reopen.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  // Belt and braces for the one type that can carry script: an SVG served as
  // image/svg+xml is inert inside <img>, but never let it be sniffed as HTML.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  return res.status(200).send(bytes);
}
