// The pieces of a board's link preview that have to run in two places at once:
// the Vercel Edge Middleware (middleware.js, in front of the static index.html)
// and the local express server (serve.mjs). Pure and dependency-free so the
// edge runtime can load it.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The unfurlers that fetch a pasted link to draw its card. Only these get the
// OG shell - a person opening the same link still gets the app.
export const BOT_UA = /facebookexternalhit|Twitterbot|Slackbot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|iMessage|Applebot|Googlebot/i;

// The board id a crawler is asking for, or null when this request should fall
// through to the SPA: a person, a non-board URL, or an id that is not a uuid.
export function shareBoardId(url, userAgent) {
  if (!BOT_UA.test(userAgent || "")) return null;
  let id = "";
  try { id = new URL(url, "http://x").searchParams.get("id") || ""; } catch { return null; }
  return UUID.test(id) ? id : null;
}

// One line that says what is on the board, built from its own graph, instead of
// the same generic sentence on every card.
export function describeBoard(row) {
  const n = Array.isArray(row?.nodes) ? row.nodes.length : Number(row?.node_count) || 0;
  const e = Array.isArray(row?.edges) ? row.edges.length : Number(row?.edge_count) || 0;
  if (!n) return "An evidence board on Forensic.";
  const plural = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
  return `${plural(n, "exhibit")} and ${plural(e, "thread")} on an evidence board.`;
}
