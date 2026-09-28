import { createHash } from "node:crypto";
import db from "../db.js";
import { guard } from "../wrap.js";
import { UUID, describeBoard } from "../share.js";

// GET /api/og?id=<uuid> -> the HTML shell a link unfurler reads for a shared
// board: title, a line about what is on it, and og:image pointing at the
// board's real snapshot (/api/og-image). Humans never land here - the edge
// middleware only rewrites crawlers - but the page still refreshes to the app
// for anyone who does.
const BASE = "https://forensic-bheng.vercel.app";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Crawlers cache an image by its URL for days. Keying the URL on the snapshot's
// own bytes means a board that changed previews as it is now, not as it was
// when the link was first pasted - and a thumbnail-only PUT (no updated_at
// bump) still busts it.
export const thumbVersion = (thumbnail) => createHash("sha1").update(thumbnail).digest("hex").slice(0, 10);

export default async function og(req, res) {
  if (!(await guard(req, res, { methods: ["GET"], limit: { key: "og", limit: 120, windowMs: 60000 } }))) return;
  const id = (req.query && req.query.id) || "";
  if (!UUID.test(id)) return res.status(400).json({ error: "Invalid id" });

  let title = "Forensic - infinite evidence board";
  let desc = "Pin images and wire the connections on an infinite, Figma-fast board.";
  let image = `${BASE}/og.png`;
  try {
    const { rows } = await db.query(
      "SELECT title, thumbnail, jsonb_array_length(nodes) AS node_count, jsonb_array_length(edges) AS edge_count FROM boards WHERE id = $1 AND trashed_at IS NULL",
      [id],
    );
    if (rows.length) {
      title = rows[0].title || "Untitled Board";
      desc = describeBoard(rows[0]);
      if (rows[0].thumbnail) image = `${BASE}/api/og-image?id=${id}&v=${thumbVersion(rows[0].thumbnail)}`;
    }
  } catch { /* a card is decoration: an unreachable database must never take the link down */ }

  const url = `${BASE}/?id=${id}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${esc(title)} - Forensic</title>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Forensic"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${esc(image)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${esc(title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${esc(image)}"/>
<meta http-equiv="refresh" content="0;url=/?id=${id}"/>
</head><body>Redirecting...</body></html>`);
}
