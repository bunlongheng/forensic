import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));
vi.mock("../../lib/rate-limit.js", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const { default: og, thumbVersion } = await import("../../lib/handlers/og.js");
const { rateLimit } = await import("../../lib/rate-limit.js");

const ID = "11111111-1111-1111-1111-111111111111";
const THUMB = "data:image/webp;base64,UklGRg==";
const req = (id, method = "GET") => ({ method, query: { id }, headers: {}, socket: { remoteAddress: "203.0.113.7" } });
const res = () => {
  const r = { headers: {}, code: 0, body: null, sent: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.sent = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};

beforeEach(() => { query.mockReset(); rateLimit.mockReturnValue({ ok: true }); });

describe("GET /api/og", () => {
  it("builds the card from the board: title, what is on it, its own snapshot", async () => {
    query.mockResolvedValue({ rows: [{ title: "Case <Alpha> & \"Beta\"", thumbnail: THUMB, node_count: 4, edge_count: 2 }] });
    const r = res();
    await og(req(ID), r);
    expect(r.code).toBe(200);
    expect(r.headers["Content-Type"]).toMatch(/text\/html/);
    expect(r.sent).toContain('<meta property="og:title" content="Case &lt;Alpha&gt; &amp; &quot;Beta&quot;"/>');
    expect(r.sent).toContain('content="4 exhibits and 2 threads on an evidence board."');
    expect(r.sent).toContain(`content="https://forensic-bheng.vercel.app/api/og-image?id=${ID}&amp;v=${thumbVersion(THUMB)}"`);
    expect(r.sent).toContain(`<meta http-equiv="refresh" content="0;url=/?id=${ID}"/>`);
    expect(r.sent).not.toContain("<Alpha>");
  });

  it("falls back to the site card when the board has no snapshot yet", async () => {
    query.mockResolvedValue({ rows: [{ title: "Fresh", thumbnail: null, node_count: 0, edge_count: 0 }] });
    const r = res();
    await og(req(ID), r);
    expect(r.sent).toContain('content="https://forensic-bheng.vercel.app/og.png"');
    expect(r.sent).toContain('content="An evidence board on Forensic."');
  });

  it("still answers with the generic card when the board is unknown or the DB is down", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    let r = res();
    await og(req(ID), r);
    expect(r.code).toBe(200);
    expect(r.sent).toContain("Forensic - infinite evidence board");

    query.mockRejectedValueOnce(new Error("down"));
    r = res();
    await og(req(ID), r);
    expect(r.code).toBe(200);
    expect(r.sent).toContain("/og.png");
  });

  // The id is interpolated into the HTML, so it is a uuid or nothing.
  it("refuses a non-uuid id before touching the DB", async () => {
    const r = res();
    await og(req('"><script>'), r);
    expect(r.code).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("is GET-only and rate-limited", async () => {
    let r = res();
    await og(req(ID, "POST"), r);
    expect(r.code).toBe(405);
    rateLimit.mockReturnValueOnce({ ok: false, retryAfter: 9 });
    r = res();
    await og(req(ID), r);
    expect(r.code).toBe(429);
  });

  it("keys the image URL on the snapshot bytes, so a repaint is a new URL", () => {
    expect(thumbVersion(THUMB)).toMatch(/^[0-9a-f]{10}$/);
    expect(thumbVersion(THUMB)).not.toBe(thumbVersion(THUMB + "AA"));
  });
});
