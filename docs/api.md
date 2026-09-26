# API

Forensic's HTTP API. Every route is a handler in `lib/handlers/` imported by both
`api/*.js` (Vercel functions) and `serve.mjs` (local / CI Express server) - one
source of truth, two wire-ups (see `CONTRIBUTING.md`).

All request/response bodies are JSON. All SQL is parameterized. Errors are
`{ "error": "message" }` with the status code shown below.

## Auth

| Mode | How | Used by |
|------|-----|---------|
| Session cookie | `fx_session`, HMAC-signed, set by `GET /api/auth/callback` after Google sign-in. Single allowed account (`OWNER_EMAIL`). | Owner-only routes |
| Bearer | `Authorization: Bearer <FORENSIC_API_SECRET>` | `POST /api/ai/boards` only (create-only, agent-facing) - rejected everywhere else, including `POST /api/images` |
| Local dev | Requests from `127.0.0.1` / LAN count as the owner, but only when `LOCAL_DEV=true` is set explicitly - it is opt-in in every environment, not just Vercel. Never honored on any Vercel deployment (prod or preview) regardless of the setting (`lib/env.js` fails the build if `LOCAL_DEV=true` is ever set there). | Local/CI only |
| Public | No auth | Reading a board or image by id, health |

State-changing session requests also require same-site fetch metadata or a
same-origin `Origin` header (CSRF defense in depth) - see `lib/auth-owner.js`.

## Routes

| Method | Path | Auth | Rate limit (per warm instance) |
|--------|------|------|------|
| GET | `/api/auth/login` | public | 20/min (`login`) |
| GET | `/api/auth/callback` | public | 20/min (`callback`) |
| GET | `/api/auth/me` | public | none |
| POST | `/api/auth/logout` | public (clears the cookie unconditionally) | none |
| POST | `/api/ai/boards` | Bearer, owner session, or local dev | 60/min (`create`) |
| POST | `/api/boards` | owner session or local dev only (Bearer rejected) | 60/min (`create`) |
| GET | `/api/boards` | owner session or local dev only | 120/min (`list`) |
| GET | `/api/boards/:id` | public | 180/min (`read`) |
| PUT | `/api/boards/:id` | owner session or local dev only (Bearer rejected) | 120/min (`update`) |
| DELETE | `/api/boards/:id` | owner session or local dev only (Bearer rejected) | none |
| POST | `/api/images` | owner session or local dev only (Bearer rejected) | 120/min (`image-write`) |
| GET | `/api/images/:id` | public | 300/min per IP (`image-read`) |
| GET | `/api/health` | public | none |

Rate limiting is best-effort, in-memory, per warm serverless instance - not a
global guarantee across instances/regions (`lib/rate-limit.js`). A limited
request gets `429` with a `Retry-After` header (seconds).

### POST /api/ai/boards - create a board (the agent-facing route)

The only route documented for external integration. Owned by `OWNER_USER_ID`.

```bash
curl -X POST https://forensic-bheng.vercel.app/api/ai/boards \
  -H "Authorization: Bearer $FORENSIC_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Untitled Board",
    "type": "board",
    "nodes": [{ "id": "node-1", "position": { "x": 40, "y": 200 } }],
    "edges": []
  }'
```

Body fields (validated in `lib/validate.js`):

| Field | Type | Limit |
|-------|------|-------|
| `title` | string, optional (default `"Untitled Board"`) | max 200 characters |
| `nodes` | array of `{ id, ... }`, optional | max 1000 items; nodes JSON max 4 MB |
| `edges` | array of `{ source, target, ... }`, optional | max 2000 items |
| `tags` | array of strings, optional | max 50 items, each max 64 characters |
| `type` | string, optional (default `"board"`) | max 40 characters |

Response `201`:

```json
{ "id": "uuid", "title": "...", "slug": "...", "nodes": [...], "edges": [...], "type": "board", "tags": [], "created_at": "...", "updated_at": "..." }
```

- `400` - validation failed; body includes `required_fields` and a `sample_request` matching the route actually hit (Bearer callers get `/api/ai/boards` with the Bearer header, session callers get `/api/boards`).
- `401` - not authorized.
- `429` - rate limited.
- `500` - `OWNER_USER_ID` not configured, or the insert failed.

Image bytes are never sent inline here - pin a photo with its own
`POST /api/images` request, then reference `/api/images/<id>` as a node's `src`
(see "Images" in the README).

### POST /api/boards - create a board (owner/local only)

Same handler and body shape as above, but the public Bearer key is rejected;
only the owner's signed-in session or local dev may call it.

### GET /api/boards - list the owner's boards

Owner-only. Returns up to 100 boards, most recently updated first. Each row also
carries `node_count` and `edge_count`. A board **with a thumbnail** returns
`nodes: null` and `edges: null` - the gallery draws the saved thumbnail image for
that card, so the graph itself never has to ride along; a board with no
thumbnail still needs its graph to draw a vector preview, so `nodes`/`edges` come
back with each node's `data.src` stripped and replaced with `data.hasImage: true`
(the list payload stays proportional to node count, not image bytes - open a
board via `GET /api/boards/:id` for the full row either way). `?trash=1` lists
the Trash instead (soft-deleted boards, ordered by `trashed_at` descending).

### GET /api/boards/:id - read a board

Public (this is what makes a share link work). `404` if not found or trashed.
Response: `{ id, title, slug, nodes, edges, type, tags, thumbnail, created_at, updated_at }`.

### PUT /api/boards/:id - update a board (autosave)

Owner-only. Partial update: only the fields present in the body are validated
and written. `{ "restore": true }` clears `trashed_at` and returns the full board
(`{ id, title, slug, nodes, edges, type, tags, created_at, updated_at }`)
unchanged - all other fields are ignored on a restore call. Every other update
returns only `{ id, title, slug, updated_at }`, not the full board - autosave
fires this every 1100ms while editing and only reads those fields back, so
echoing the whole board (nodes and edges included) doubled the cost of every
save for nothing. A thumbnail-only PUT (`{ "thumbnail": "..." }`, no `nodes`)
does **not** bump `updated_at`, so repainting the gallery snapshot never
reorders or re-timestamps the board. `400` on invalid fields, `404` if not found
or already trashed.

### DELETE /api/boards/:id - delete or trash a board

Owner-only. Boards with 3+ nodes soft-delete to Trash (`trashed_at = now()`);
boards with fewer than 3 nodes, or an explicit `?purge=1`, are removed outright.
A repeat DELETE of a board that is already trashed does **not** hard-delete it -
it returns `{ "trashed": true }` and leaves the board in Trash untouched, so a
stale tab firing the same "Move to Trash" action twice can never destroy a board
the confirm dialog promised was recoverable. A removed-outright delete also
deletes the board's images (its `board_images` rows) - unless another board's
nodes still reference that same image, in which case that image is kept.
Response: `{ "trashed": true }` or `{ "deleted": true|false }`.

### POST /api/images - upload one image

Owner session or local dev only - the Bearer key cannot upload (it is scoped to
create-only board creation). Body: `{ "src": "data:image/webp;base64,..." }`
- one of `image/webp`, `image/png`, `image/jpeg`, `image/gif`, `image/svg+xml`,
`image/avif`, max 3,000,000 bytes raw (`IMAGE_MAX_BYTES` in
`lib/handlers/images.js`, mirrored by `IMAGE_MAX` in `src/lib/constants.js`).
Response `201`: `{ "id": "uuid", "url": "/api/images/<id>", "size": <bytes> }`.
`400` invalid/unsupported data URL, `413` too large.

### GET /api/images/:id - read an image

Public (same reasoning as a shared board: these bytes were already public when
they lived inline in the board JSON), rate-limited 300/min per IP - a full read
out of Postgres, up to 3 MB, so a generous per-IP budget bounds a client that
loops on one known id. Served with
`Cache-Control: public, max-age=31536000, immutable` - an image row is never
rewritten, so it can be cached forever - plus a sandboxed
`Content-Security-Policy: sandbox; script-src 'none'` and `X-Content-Type-Options:
nosniff`, so an `image/svg+xml` row navigated to directly (not rendered inside an
`<img>`) renders inert instead of as a scriptable same-origin document.

### GET /api/health - liveness/readiness

Public. Checks the API secret, owner id, Google OAuth vars, auth secret, owner
email are all configured, and that the database is reachable. `200` with
`{ ok: true, version, checks }` when everything passes, `503` otherwise. Used
by `.github/workflows/prod-monitor.yml` as the post-deploy smoke test and the
scheduled uptime check.

## Deploy and auto-migration

`vercel.json`'s `buildCommand` runs `node db/migrate.mjs` before `vite build`,
but only when `VERCEL_ENV=production` - so a production deploy applies any new
`db/migrations/*.sql` file automatically, ahead of the code that needs it, with
no rollback. Migrations must therefore be additive/expand-only (see
`CONTRIBUTING.md`). `ignoreCommand` skips the deploy entirely for a commit whose
subject starts with `chore:`, `ci:`, `test:`, or `docs:`.
