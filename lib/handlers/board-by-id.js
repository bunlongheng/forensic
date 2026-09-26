import db from "../db.js";
import { ownerId } from "../auth-owner.js";
import { guard } from "../wrap.js";
import { validateBoardFields } from "../validate.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_REF = /^\/api\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function bad(res, error) {
  return res.status(400).json({ error });
}

// The board_images ids a board's nodes point at. board_images has no board_id
// and no cascade, so a hard delete has to name them itself.
function imageIdsIn(nodes) {
  const ids = new Set();
  for (const n of Array.isArray(nodes) ? nodes : []) {
    const m = IMAGE_REF.exec((n && n.data && n.data.src) || "");
    if (m) ids.add(m[1]);
  }
  return [...ids];
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
  if (!UUID.test(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  if (req.method === "GET") {
    if (!(await guard(req, res, { limit: { key: "read", limit: 180, windowMs: 60000 } }))) return;
    const { rows } = await db.query(
      "SELECT id, title, slug, nodes, edges, type, tags, thumbnail, created_at, updated_at FROM boards WHERE id = $1 AND trashed_at IS NULL",
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(rows[0]);
  }

  if (req.method === "PUT") {
    const ok = await guard(req, res, {
      limit: { key: "update", limit: 120, windowMs: 60000 },
      auth: "owner",
    });
    if (!ok) return;

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

    const { title, nodes, edges, tags, thumbnail } = body;

    // ── Validate only the fields that were provided ──────────────────────────
    const { error } = validateBoardFields({ title, nodes, edges, tags, thumbnail }, { partial: true });
    if (error) return bad(res, error);

    // ── Build a partial UPDATE with only provided fields (parameterized) ─────
    // updated_at tracks CONTENT, not the gallery snapshot: a thumbnail-only PUT
    // (repaint / backfill) must not bump the board to the top of the gallery or
    // relabel it "just now" when nothing about the board actually changed.
    const touchesContent = title !== undefined || nodes !== undefined || edges !== undefined || tags !== undefined;
    const sets = touchesContent ? ["updated_at = now()"] : [];
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
    // The gallery snapshot rides its own tiny PUT (no nodes), so a board too big
    // to sync its content can still keep a current thumbnail.
    if (thumbnail !== undefined) {
      sets.push(`thumbnail = $${i++}`);
      values.push(thumbnail);
    }
    if (!sets.length) return bad(res, "Nothing to update.");
    values.push(id);

    // Autosave fires this every 1100ms while editing, so the response carries
    // only what the client actually reads back - echoing the whole board (nodes
    // and edges included) doubled the cost of every save for nothing.
    const { rows } = await db.query(
      `UPDATE boards SET ${sets.join(", ")} WHERE id = $${i} AND trashed_at IS NULL RETURNING id, title, slug, updated_at`,
      values,
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(rows[0]);
  }

  if (req.method === "DELETE") {
    if (!(await guard(req, res, { auth: "owner" }))) return;
    const purge = req.query?.purge === "1" || req.query?.purge === 1;
    const { rows } = await db.query(
      "SELECT jsonb_array_length(COALESCE(nodes,'[]'::jsonb)) AS n, trashed_at, nodes FROM boards WHERE id = $1",
      [id],
    );
    if (rows.length === 0) return res.status(200).json({ deleted: false });
    // Substantial boards (3+ nodes) go to Trash first so a delete is never fatal.
    // Small/scratch boards and explicit purges are gone for good.
    if (!purge && (rows[0].n || 0) >= 3) {
      // Already trashed: this is a repeat of the same "Move to Trash" action from
      // a stale tab. It used to fall through to a HARD delete, so a second click
      // in a gallery that had not refreshed destroyed the board for good - while
      // the confirm dialog promised "you can restore it later".
      if (rows[0].trashed_at) return res.status(200).json({ trashed: true });
      await db.query("UPDATE boards SET trashed_at = now() WHERE id = $1", [id]);
      return res.status(200).json({ trashed: true });
    }
    // A hard delete takes the board's photos with it. Without this the bytes stay
    // fetchable at /api/images/<uuid> forever by anyone who ever opened the shared
    // link - on an evidence board, "delete forever" has to include the evidence.
    // The clipboard carries image refs across boards, so only drop a photo no
    // OTHER board still points at.
    const imageIds = imageIdsIn(rows[0].nodes);
    if (imageIds.length > 0) {
      await db.query(
        `DELETE FROM board_images bi WHERE bi.user_id = $1 AND bi.id = ANY($2::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM boards b, jsonb_array_elements(COALESCE(b.nodes, '[]'::jsonb)) n
             WHERE b.id <> $3 AND n->'data'->>'src' = '/api/images/' || bi.id::text
           )`,
        [ownerId() || "owner", imageIds, id],
      );
    }
    const { rowCount } = await db.query("DELETE FROM boards WHERE id = $1", [id]);
    return res.status(200).json({ deleted: rowCount > 0 });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
