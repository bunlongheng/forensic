import db from "../db.js";
import { authorizeOwner, ownerId } from "../auth-owner.js";
import { uniqueBoardSlug } from "../slugs.js";
import { rateLimit } from "../rate-limit.js";

const SAMPLE_BODY = {
  title: "Untitled Board",
  type: "board",
  nodes: [{ id: "node-1", position: { x: 40, y: 200 } }],
  edges: [],
};

function bad(res, error, extra = {}) {
  return res.status(400).json({
    error,
    required_fields: {
      title: 'string, optional (default "Untitled Board") - max 200 characters',
      nodes: "array, optional - React Flow nodes, each { id, ... }; max 1000",
      edges: "array, optional - React Flow edges, each { source, target, ... }; max 2000",
    },
    sample_request: {
      method: "POST",
      url: "/api/boards",
      headers: { "Content-Type": "application/json" },
      body: SAMPLE_BODY,
    },
    ...extra,
  });
}

// POST /api/boards -> create a new board owned by OWNER_USER_ID. Owner session,
// Bearer FORENSIC_API_SECRET, or local dev may create.
export default async function createBoard(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await authorizeOwner(req))) return res.status(401).json({ error: "Unauthorized" });

  const limited = rateLimit(req, { key: "create", limit: 60, windowMs: 60000 });
  if (!limited.ok) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { title = "Untitled Board", nodes = [], edges = [], tags = [], type = "board" } = body;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (typeof title !== "string" || !title.trim()) return bad(res, "title must be a non-empty string.");
  if (title.length > 200) return bad(res, "title too long (max 200 characters).");
  if (!Array.isArray(nodes)) return bad(res, "nodes must be an array.");
  if (nodes.length > 1000) return bad(res, "too many nodes (max 1000).");
  for (const n of nodes) {
    if (!n || typeof n !== "object" || typeof n.id !== "string") {
      return bad(res, "Every node must be an object with a string id.");
    }
  }
  if (!Array.isArray(edges)) return bad(res, "edges must be an array.");
  if (edges.length > 2000) return bad(res, "too many edges (max 2000).");
  for (const e of edges) {
    if (!e || typeof e.source !== "string" || typeof e.target !== "string") {
      return bad(res, 'Every edge must have string "source" and "target" node ids.');
    }
  }

  const owner = ownerId();
  if (!owner) return res.status(500).json({ error: "OWNER_USER_ID not configured" });

  // ── Insert (PARAMETERIZED only), owned by OWNER_USER_ID ─────────────────────
  const slug = await uniqueBoardSlug(owner, title);
  const { rows } = await db.query(
    "INSERT INTO boards (user_id, title, slug, nodes, edges, type, tags) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::text[]) RETURNING id, title, slug, nodes, edges, type, tags, created_at, updated_at",
    [owner, title.trim(), slug, JSON.stringify(nodes), JSON.stringify(edges), type, tags],
  );
  if (rows.length === 0) return res.status(500).json({ error: "Insert failed" });

  return res.status(201).json(rows[0]);
}
