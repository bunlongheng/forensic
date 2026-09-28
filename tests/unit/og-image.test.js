import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));
vi.mock("../../lib/rate-limit.js", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const { default: ogImage, renderCard } = await import("../../lib/handlers/og-image.js");

const ID = "11111111-1111-1111-1111-111111111111";
const req = (id) => ({ method: "GET", query: { id }, headers: {}, socket: { remoteAddress: "203.0.113.7" } });
const res = () => {
  const r = { headers: {}, code: 0, body: null, sent: null, ended: false, statusCode: 200 };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.sent = b; return r; };
  r.end = () => { r.ended = true; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};

// A real capture is a wide (1040x400) WebP on a cork-coloured canvas.
async function fakeThumb(w = 1040, h = 400, background = { r: 224, g: 207, b: 166 }) {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background } }).webp().toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

beforeEach(() => { query.mockReset(); });

describe("renderCard", () => {
  it("fits the snapshot into 1200x630 as JPEG and fills the bars with the canvas colour", async () => {
    const jpeg = await renderCard(await fakeThumb());
    const img = sharp(jpeg);
    const meta = await img.metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
    // The letterbox bar (top-left) is the same cork as the capture, not black.
    const [r, g, b] = await img.extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect(Math.abs(r - 224) + Math.abs(g - 207) + Math.abs(b - 166)).toBeLessThan(12);
  });

  // A capture is mostly empty cork around a cluster of pins; the card shows the
  // cluster, not the cork.
  it("trims the empty canvas around the board so it fills the card", async () => {
    const cork = { r: 224, g: 207, b: 166 };
    const pins = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 40, g: 40, b: 40 } } }).png().toBuffer();
    const buf = await sharp({ create: { width: 1040, height: 400, channels: 3, background: cork } })
      .composite([{ input: pins, left: 420, top: 100 }]).webp().toBuffer();
    const jpeg = await renderCard(`data:image/webp;base64,${buf.toString("base64")}`);
    // Just inside the 36px frame, the dark cluster has been scaled up to reach.
    const [r] = await sharp(jpeg).extract({ left: 600, top: 40, width: 1, height: 1 }).raw().toBuffer();
    expect(r).toBeLessThan(80);
  });

  it("refuses anything that is not an image data URL", async () => {
    expect(await renderCard("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(await renderCard("https://evil/x.png")).toBeNull();
  });
});

describe("GET /api/og-image", () => {
  it("serves the card with a long cache and its length", async () => {
    query.mockResolvedValue({ rows: [{ thumbnail: await fakeThumb(200, 100) }] });
    const r = res();
    await ogImage(req(ID), r);
    expect(r.code).toBe(200);
    expect(r.headers["Content-Type"]).toBe("image/jpeg");
    expect(r.headers["Cache-Control"]).toMatch(/s-maxage=86400/);
    expect(Number(r.headers["Content-Length"])).toBe(r.sent.length);
  });

  it("sends the site card instead when there is no snapshot, or no board", async () => {
    query.mockResolvedValueOnce({ rows: [{ thumbnail: null }] });
    let r = res();
    await ogImage(req(ID), r);
    expect([r.statusCode, r.headers.Location, r.ended]).toEqual([302, "/og.png", true]);

    query.mockResolvedValueOnce({ rows: [] });
    r = res();
    await ogImage(req(ID), r);
    expect(r.statusCode).toBe(302);
  });

  it("refuses a non-uuid id before touching the DB", async () => {
    const r = res();
    await ogImage(req("nope"), r);
    expect(r.code).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
