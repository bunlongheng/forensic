import db from "../db.js";
import { authorizeOwner } from "../auth-owner.js";
import { rateLimit } from "../rate-limit.js";

function bad(res, error) {
  return res.status(400).json({ error });
}

// GET    /api/boards/:id -> public read of a saved board (the { nodes, edges }
//                           the SPA renders on the canvas).
// PUT    /api/boards/:id -> owner-only partial update (autosave).
// DELETE /api/boards/:id -> owner-only removal: requires the owner's signed-in
//                           session (fx_session) or local dev. The public create
//                           Bearer secret cannot delete.
export default async function boardById(req, res) {
  const id = (req.query && req.query.id) || (req.params && req.params.id) || null;
  if (!id) return res.status(400).json({ error: "Missing id" });

  // Validate the uuid shape before hitting the DB: a non-uuid would otherwise
  // throw "invalid input syntax for type uuid" and surface as a generic 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  if (req.method === "GET") {
    const limited = rateLimit(req, { key: "read", limit: 180, windowMs: 60000 });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfter));
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    const { rows } = await db.query(
      "SELECT id, title, slug, nodes, edges, type, tags, created_at, updated_at FROM boards WHERE id = $1",
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(rows[0]);
  }

  if (req.method === "PUT") {
    if (!(await authorizeOwner(req, { allowBearer: true }))) return res.status(401).json({ error: "Unauthorized" });

    const limited = rateLimit(req, { key: "update", limit: 120, windowMs: 60000 });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfter));
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Restore from Trash: clear trashed_at and return the board unchanged.
    if (body.restore === true) {
      const { rows } = await db.query(
        "UPDATE boards SET trashed_at = NULL, updated_at = now() WHERE id = $1 RETURNING id, title, slug, nodes, edges, type, tags, created_at, updated_at",
        [id],
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      return res.status(200).json(rows[0]);
    }

    const { title, nodes, edges, tags } = body;

    // ── Validate only the fields that were provided ──────────────────────────
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) return bad(res, "title must be a non-empty string.");
      if (title.length > 200) return bad(res, "title too long (max 200 characters).");
    }
    if (nodes !== undefined) {
      if (!Array.isArray(nodes)) return bad(res, "nodes must be an array.");
      if (nodes.length > 1000) return bad(res, "too many nodes (max 1000).");
      for (const n of nodes) {
        if (!n || typeof n !== "object" || typeof n.id !== "string") {
          return bad(res, "Every node must be an object with a string id.");
        }
      }
    }
    if (edges !== undefined) {
      if (!Array.isArray(edges)) return bad(res, "edges must be an array.");
      if (edges.length > 2000) return bad(res, "too many edges (max 2000).");
      for (const e of edges) {
        if (!e || typeof e.source !== "string" || typeof e.target !== "string") {
          return bad(res, 'Every edge must have string "source" and "target" node ids.');
        }
      }
    }
    if (tags !== undefined && !Array.isArray(tags)) return bad(res, "tags must be an array.");

    // ── Build a partial UPDATE with only provided fields (parameterized) ─────
    const sets = ["updated_at = now()"];
    const values = [];
    let i = 1;
    if (title !== undefined) {
      sets.push(`title = $${i++}`);
      values.push(title.trim());
    }
    if (nodes !== undefined) {
      sets.push(`nodes = $${i++}::jsonb`);
      values.push(JSON.stringify(nodes));
    }
    if (edges !== undefined) {
      sets.push(`edges = $${i++}::jsonb`);
      values.push(JSON.stringify(edges));
    }
    if (tags !== undefined) {
      sets.push(`tags = $${i++}::text[]`);
      values.push(tags);
    }
    values.push(id);

    const { rows } = await db.query(
      `UPDATE boards SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, title, slug, nodes, edges, type, tags, created_at, updated_at`,
      values,
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(rows[0]);
  }

  if (req.method === "DELETE") {
    if (!(await authorizeOwner(req, { allowBearer: false }))) return res.status(401).json({ error: "Unauthorized" });
    const purge = req.query?.purge === "1" || req.query?.purge === 1;
    const { rows } = await db.query(
      "SELECT jsonb_array_length(COALESCE(nodes,'[]'::jsonb)) AS n, trashed_at FROM boards WHERE id = $1",
      [id],
    );
    if (rows.length === 0) return res.status(200).json({ deleted: false });
    // Substantial boards (3+ nodes) go to Trash first so a delete is never fatal.
    // Small/scratch boards, boards already in Trash, and explicit purges are gone
    // for good.
    if (!purge && !rows[0].trashed_at && (rows[0].n || 0) >= 3) {
      await db.query("UPDATE boards SET trashed_at = now() WHERE id = $1", [id]);
      return res.status(200).json({ trashed: true });
    }
    const { rowCount } = await db.query("DELETE FROM boards WHERE id = $1", [id]);
    return res.status(200).json({ deleted: rowCount > 0 });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
