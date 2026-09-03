import db from "../db.js";
import { ownerId, authorizeOwner } from "../auth-owner.js";
import { rateLimit } from "../rate-limit.js";

// GET /api/boards -> the owner's boards, most recently updated first. Owner-only
// (the gallery is signed-in-only); a shared board is read via the separate
// public GET /api/boards/:id, which stays public. Capped at 100.
export default async function listBoards(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!(await authorizeOwner(req, { allowBearer: false }))) return res.status(401).json({ error: "Unauthorized" });

  const limited = rateLimit(req, { key: "list", limit: 120, windowMs: 60000 });
  if (!limited.ok) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const owner = ownerId();
  if (!owner) return res.status(500).json({ error: "OWNER_USER_ID not configured" });

  // ?trash=1 lists the Trash (soft-deleted boards); default lists active boards.
  const trash = req.query?.trash === "1" || req.query?.trash === 1;
  // Preview projection: the gallery only draws thumbnails, so strip the inline
  // base64 image bytes (data.src) from every node and flag them hasImage instead.
  // Opening a board fetches the full row via GET /api/boards/:id. Keeps the list
  // payload proportional to node COUNT, not to total image bytes.
  const { rows } = await db.query(
    `SELECT id, title, slug,
       COALESCE((
         SELECT jsonb_agg(
           CASE WHEN (n->'data') ? 'src'
             THEN jsonb_set(n, '{data}', ((n->'data') - 'src') || '{"hasImage":true}'::jsonb)
             ELSE n END ORDER BY ord)
         FROM jsonb_array_elements(nodes) WITH ORDINALITY AS t(n, ord)
       ), '[]'::jsonb) AS nodes,
       edges, type, tags, created_at, updated_at, trashed_at
     FROM boards
     WHERE user_id = $1 AND trashed_at IS ${trash ? "NOT NULL" : "NULL"}
     ORDER BY ${trash ? "trashed_at" : "updated_at"} DESC LIMIT 100`,
    [owner],
  );
  return res.status(200).json(rows);
}
