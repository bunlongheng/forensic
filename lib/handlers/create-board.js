import db from "../db.js";
import { ownerId } from "../auth-owner.js";
import { uniqueBoardSlug } from "../slugs.js";
import { guard } from "../wrap.js";
import { validateBoardFields } from "../validate.js";

const SAMPLE_BODY = {
  title: "Untitled Board",
  type: "board",
  nodes: [{ id: "node-1", position: { x: 40, y: 200 } }],
  edges: [],
};

function bad(res, error, opts, extra = {}) {
  const allowBearer = opts.allowBearer !== false;
  return res.status(400).json({
    error,
    required_fields: {
      title: 'string, optional (default "Untitled Board") - max 200 characters',
      nodes: "array, optional - React Flow nodes, each { id, ... }; max 1000",
      edges: "array, optional - React Flow edges, each { source, target, ... }; max 2000",
    },
    sample_request: {
      method: "POST",
      url: allowBearer ? "/api/ai/boards" : "/api/boards",
      headers: allowBearer
        ? { "Content-Type": "application/json", Authorization: "Bearer <FORENSIC_API_SECRET>" }
        : { "Content-Type": "application/json" },
      body: SAMPLE_BODY,
    },
    ...extra,
  });
}

// POST /api/ai/boards -> create a new board owned by OWNER_USER_ID. Owner
// session, Bearer FORENSIC_API_SECRET, or local dev may create.
// POST /api/boards -> same handler, but the caller passes { allowBearer:
// false } so the public Bearer key is scoped to /api/ai/boards only.
export default async function createBoard(req, res, opts = {}) {
  // Same preamble as every other handler, and in guard's order: the limiter
  // runs BEFORE auth, so an unauthenticated flood against this public Bearer
  // endpoint spends its budget instead of buying a free 401 per request.
  const ok = await guard(req, res, {
    methods: ["POST"],
    limit: { key: "create", limit: 60, windowMs: 60000 },
    auth: opts.allowBearer !== false ? "bearer" : "owner",
  });
  if (!ok) return;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { title = "Untitled Board", nodes = [], edges = [], tags = [], type = "board" } = body;

  // ── Validate ──────────────────────────────────────────────────────────────
  const { error } = validateBoardFields({ title, nodes, edges, tags, type }, { partial: false });
  if (error) return bad(res, error, opts);

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
