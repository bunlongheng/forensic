import db from "../db.js";
import { ownerId } from "../auth-owner.js";
import { guard } from "../wrap.js";

// Preview projection: the gallery only draws thumbnails, so strip the inline
// base64 image bytes (data.src) from every node and flag them hasImage instead.
// Opening a board fetches the full row via GET /api/boards/:id.
const NODES_PREVIEW = `COALESCE((
         SELECT jsonb_agg(
           CASE WHEN (n->'data') ? 'src'
             THEN jsonb_set(n, '{data}', ((n->'data') - 'src') || '{"hasImage":true}'::jsonb)
             ELSE n END ORDER BY ord)
         FROM jsonb_array_elements(nodes) WITH ORDINALITY AS t(n, ord)
       ), '[]'::jsonb)`;

// nodes/edges ride along ONLY for a board with no thumbnail, where the gallery
// still has to draw the vector Preview from the graph itself. A card that has a
// thumbnail gets `nodes: null` and `edges: null` - node_count / edge_count carry
// the counts it labels instead of 2 whole graphs per card, 100 cards a page.
const SELECT_LIST = `SELECT id, title, slug,
       CASE WHEN thumbnail IS NULL THEN ${NODES_PREVIEW} END AS nodes,
       CASE WHEN thumbnail IS NULL THEN edges END AS edges,
       jsonb_array_length(COALESCE(nodes, '[]'::jsonb)) AS node_count,
       jsonb_array_length(COALESCE(edges, '[]'::jsonb)) AS edge_count,
       type, tags, thumbnail, created_at, updated_at, trashed_at
     FROM boards`;

// Static SQL per branch, values as $n only. This used to interpolate the WHERE
// and ORDER BY through a template literal - safe as written, and exactly the
// shape the next runtime parameter would turn into an injection.
const ACTIVE_SQL = `${SELECT_LIST}
     WHERE user_id = $1 AND trashed_at IS NULL
     ORDER BY updated_at DESC LIMIT 100`;

const TRASH_SQL = `${SELECT_LIST}
     WHERE user_id = $1 AND trashed_at IS NOT NULL
     ORDER BY trashed_at DESC LIMIT 100`;

// GET /api/boards -> the owner's boards, most recently updated first. Owner-only
// (the gallery is signed-in-only); a shared board is read via the separate
// public GET /api/boards/:id, which stays public. Capped at 100.
export default async function listBoards(req, res) {
  const ok = await guard(req, res, {
    methods: ["GET"],
    limit: { key: "list", limit: 120, windowMs: 60000 },
    auth: "owner",
  });
  if (!ok) return;

  const owner = ownerId();
  if (!owner) return res.status(500).json({ error: "OWNER_USER_ID not configured" });

  // ?trash=1 lists the Trash (soft-deleted boards); default lists active boards.
  const trash = req.query?.trash === "1" || req.query?.trash === 1;
  const { rows } = await db.query(trash ? TRASH_SQL : ACTIVE_SQL, [owner]);
  return res.status(200).json(rows);
}
