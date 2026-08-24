import db from "../db.js";
import { ownerId, authorizeOwner } from "../auth-owner.js";
import { rateLimit } from "../rate-limit.js";

// GET /api/boards -> the owner's boards, most recently updated first. Owner-only
// (the gallery is signed-in-only); a shared board is read via the separate
// public GET /api/boards/:id, which stays public. Capped at 100.
export default async function listBoards(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!(await authorizeOwner(req))) return res.status(401).json({ error: "Unauthorized" });

  const limited = rateLimit(req, { key: "list", limit: 120, windowMs: 60000 });
  if (!limited.ok) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const owner = ownerId();
  if (!owner) return res.status(500).json({ error: "OWNER_USER_ID not configured" });

  const { rows } = await db.query(
    "SELECT id, title, slug, nodes, edges, type, tags, created_at, updated_at FROM boards WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100",
    [owner],
  );
  return res.status(200).json(rows);
}
