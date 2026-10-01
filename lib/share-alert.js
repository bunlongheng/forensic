// Who opened a shared board. Every real view of a public share link (a person
// who is not the owner, not a link-preview crawler) is written to share_view_log
// and then alerts the owner on every channel that is configured: email through
// Resend (RESEND_API_KEY) and a note on the owner's Stickies board
// (STICKIES_API_KEY).
//
// Fire and forget: call notifyShareView without awaiting. It never throws and
// never blocks the response - a failed alert must not stop a visitor reading
// the board.
import db from "./db.js";

// Link-preview crawlers (iMessage, Slack, WhatsApp, Twitter, Facebook) fetch a
// shared URL without a person behind it. Broader than share.js's BOT_UA on
// purpose: that one decides who gets the OG shell, this one decides who is not
// a view. Headless browsers (the e2e suite) are not a view either.
export function isBot(userAgent) {
  return /bot|crawler|spider|preview|facebookexternalhit|slackbot|twitterbot|whatsapp|telegram|discord|skype|linkedin|applebot|headless/i.test(userAgent || "");
}

const PRIVATE_IP = /^(unknown|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

// Enrich a public IP via ipinfo.io (keyless; IPINFO_TOKEN lifts the rate limit).
// 3 s cap, null on any failure, skipped for private and loopback ranges.
export async function lookupIp(ip) {
  if (!ip || PRIVATE_IP.test(ip)) return null;
  try {
    const token = process.env.IPINFO_TOKEN ? `?token=${encodeURIComponent(process.env.IPINFO_TOKEN)}` : "";
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${token}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const j = await res.json();
    const pick = (k) => (typeof j[k] === "string" && j[k] ? j[k] : null);
    return {
      hostname: pick("hostname"), city: pick("city"), region: pick("region"), country: pick("country"),
      loc: pick("loc"), org: pick("org"), postal: pick("postal"), timezone: pick("timezone"),
    };
  } catch {
    return null;
  }
}

// First hop of x-vercel-forwarded-for is the real client on Vercel; the others
// are proxies. Off Vercel the socket peer is the only honest source.
export function clientIp(req) {
  const h = req.headers || {};
  const raw = h["x-vercel-forwarded-for"] || h["x-forwarded-for"] || h["x-real-ip"] || "";
  const first = String(raw).split(",")[0].trim();
  if (first) return first;
  const peer = (req.socket && req.socket.remoteAddress) || "";
  return peer.replace(/^::ffff:/, "") || "unknown";
}

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// The visit a request represents, read before the response goes out so the
// headers are still at hand. kind is "view" (the open link) or "unlock"
// (a passcode entered) - boards have no passcode, so it is "view" here.
export function readVisit(req, board, kind = "view") {
  const h = req.headers || {};
  return {
    boardId: board.id,
    title: board.title || "Untitled Board",
    kind,
    ip: clientIp(req),
    city: h["x-vercel-ip-city"] ? decode(h["x-vercel-ip-city"]) : null,
    country: h["x-vercel-ip-country"] || null,
    userAgent: h["user-agent"] || null,
    referer: h["referer"] || null,
    at: new Date(),
  };
}

// The share link the visitor opened, as it was pasted: the public app URL.
const BASE = process.env.FORENSIC_APP_URL || "https://forensic-bheng.vercel.app";
export const shareUrl = (boardId) => `${BASE}/?id=${boardId}`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// One HTML body for both the email and the note: inline styles only, 640px.
export function alertHtml(v, viewNumber) {
  const g = v.geo || {};
  const city = g.city || v.city;
  const country = g.country || v.country;
  const when = v.at.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
  const [lat, lon] = (g.loc || "").split(",");
  const mapUrl = lat && lon
    ? `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lon},${lat}&z=9&size=600,300&l=map&pt=${lon},${lat},pm2rdm`
    : null;
  const action = v.kind === "unlock" ? "entered the passcode" : "opened the shared link";
  const cell = (k, html) =>
    `<tr><td style="padding:7px 16px 7px 0;color:#71717a;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td>` +
    `<td style="padding:7px 0;color:#18181b;font-size:14px;font-weight:600;word-break:break-word">${html}</td></tr>`;
  const row = (k, val) => cell(k, val ? esc(val) : '<span style="color:#a1a1aa;font-weight:400">unknown</span>');
  const link = shareUrl(v.boardId);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:8px 0 24px;color:#18181b">
  <div style="display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a1a1aa;font-weight:700;margin-bottom:6px"><img src="${BASE}/icon-96.png" alt="Forensic" width="22" height="22" style="width:22px;height:22px;border-radius:6px;vertical-align:middle">Share - ${v.kind === "unlock" ? "passcode unlock" : "link opened"}</div>
  <h1 style="font-size:20px;line-height:1.35;margin:0 0 14px;color:#18181b">Someone opened "${esc(v.title)}"</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3f3f46">Someone from <b>${esc(v.ip)}</b> ${action} on <b>${when}</b>${country ? ` from <b style="color:#ef4444">${esc(country)}</b>` : ""}. This is view <b>${viewNumber}</b> of this board.</p>
  <table style="border-collapse:collapse;width:100%;max-width:100%;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:0 0 18px">
    ${cell("Link", `<a href="${esc(link)}" style="color:#2563eb;font-weight:600">${esc(link)}</a>`)}
    ${row("Target IP", v.ip)}
    ${row("Hostname", g.hostname)}
    ${row("City", city)}
    ${row("Region", g.region)}
    ${row("Country", country)}
    ${row("Coordinates", g.loc)}
    ${row("Org", g.org)}
    ${row("Postal", g.postal)}
    ${row("Timezone", g.timezone)}
    ${row("Referrer", v.referer)}
  </table>
  ${mapUrl ? `<img src="${mapUrl}" alt="Map near ${esc(city || v.ip)}" width="600" height="300" style="display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid #e4e4e7;margin:0 0 18px">` : ""}
  <p style="margin:0 0 6px;font-size:14px;color:#3f3f46">More detail: <a href="https://ipinfo.io/${encodeURIComponent(v.ip)}" style="color:#2563eb">ipinfo.io/${esc(v.ip)}</a></p>
  <p style="margin:0;color:#a1a1aa;font-size:12px;word-break:break-all">${esc(v.userAgent || "no user agent")}</p>
</div>`;
}

async function sendEmail(v, viewNumber) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.OWNER_EMAIL;
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.SHARE_ALERT_FROM || "Forensic <onboarding@resend.dev>",
      to: [to],
      subject: `Opened: ${v.title} - ${v.ip}`,
      html: alertHtml(v, viewNumber),
    }),
  });
  return res.ok;
}

// The same alert as a note on the owner's Stickies board, so it shows up on
// the phone like any other note. The eye is the icon Stickies uses for its own
// share alerts; the Forensic logo sits inside the body heading.
async function postAlertNote(v, viewNumber) {
  const key = process.env.STICKIES_API_KEY;
  if (!key) return false;
  const res = await fetch("http://localhost:4444/api/stickies/ext", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "html",
      title: `Opened: ${v.title.replace(/^(Opened:\s*)+/, "")}`,
      content: alertHtml(v, viewNumber),
      folder: "Alerts",
      icon: "__hero:EyeIcon",
    }),
  });
  if (!res.ok) throw new Error(`stickies ${res.status}`);
  return true;
}

// Fire and forget. Call without awaiting; it swallows its own failures.
export async function notifyShareView(v) {
  try {
    const { rows } = await db.query(
      `INSERT INTO share_view_log (board_id, title, kind, ip, city, country, user_agent, referer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [v.boardId, v.title, v.kind, v.ip, v.city, v.country, v.userAgent, v.referer],
    );
    const logId = rows[0].id;
    const count = await db.query("SELECT COUNT(*)::int AS n FROM share_view_log WHERE board_id = $1", [v.boardId]);
    const viewNumber = count.rows[0]?.n || 1;
    v.geo = await lookupIp(v.ip);
    const emailed = await sendEmail(v, viewNumber);
    if (emailed) await db.query("UPDATE share_view_log SET emailed = true WHERE id = $1", [logId]);
    const noted = await postAlertNote(v, viewNumber);
    if (!emailed && !noted) console.warn("[share-alert] neither RESEND_API_KEY nor STICKIES_API_KEY is set - view logged, nobody alerted");
  } catch (err) {
    console.error("[share-alert] failed:", err instanceof Error ? err.message : String(err));
  }
}
