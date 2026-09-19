import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));
vi.mock("../../lib/auth-owner.js", () => ({
  authorizeOwner: vi.fn(async () => true),
  ownerId: () => "owner-1",
}));
vi.mock("../../lib/rate-limit.js", () => ({ rateLimit: () => ({ ok: true }) }));

const { createImage, getImage, parseDataUrl, IMAGE_MAX_BYTES } = await import("../../lib/handlers/images.js");
const { authorizeOwner } = await import("../../lib/auth-owner.js");

const res = () => {
  const r = { headers: {}, code: 0, body: null, sent: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.sent = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const PNG = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => { query.mockReset(); authorizeOwner.mockResolvedValue(true); });

describe("parseDataUrl", () => {
  it("accepts every image type the board can render", () => {
    for (const m of ["image/webp", "image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/avif"]) {
      expect(parseDataUrl(`data:${m};base64,AAAA`)?.mime).toBe(m);
    }
  });

  // The bytes get served back with the MIME we store, so a non-image must never
  // be storable through this door.
  it("refuses anything that is not an image, and anything that is not a data URL", () => {
    expect(parseDataUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(parseDataUrl("data:application/json;base64,e30=")).toBeNull();
    expect(parseDataUrl("/api/images/abc")).toBeNull();
    expect(parseDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
    expect(parseDataUrl(null)).toBeNull();
  });
});

describe("POST /api/images", () => {
  it("stores the bytes and returns the URL a node will hold", async () => {
    query.mockResolvedValue({ rows: [{ id: "11111111-1111-1111-1111-111111111111" }] });
    const r = res();
    await createImage({ method: "POST", body: { src: PNG } }, r);
    expect(r.code).toBe(201);
    expect(r.body.url).toBe("/api/images/11111111-1111-1111-1111-111111111111");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO board_images/);
    expect(params[1]).toBe("image/png");
    expect(Buffer.isBuffer(params[2])).toBe(true);
  });

  it("refuses an unauthenticated upload", async () => {
    authorizeOwner.mockResolvedValue(false);
    const r = res();
    await createImage({ method: "POST", body: { src: PNG } }, r);
    expect(r.code).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses a payload that would not survive the platform's request cap", async () => {
    const r = res();
    const big = "data:image/png;base64," + "A".repeat(Math.ceil((IMAGE_MAX_BYTES + 1000) * 4 / 3));
    await createImage({ method: "POST", body: { src: big } }, r);
    expect(r.code).toBe(413);
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses a non-image before it ever reaches the database", async () => {
    const r = res();
    await createImage({ method: "POST", body: { src: "data:text/html;base64,PHNjcmlwdD4=" } }, r);
    expect(r.code).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("GET /api/images/:id", () => {
  it("serves the bytes with an immutable cache and no sniffing", async () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    query.mockResolvedValue({ rows: [{ mime: "image/webp", bytes }] });
    const r = res();
    await getImage({ method: "GET", query: { id: "11111111-1111-1111-1111-111111111111" } }, r);
    expect(r.code).toBe(200);
    expect(r.sent).toBe(bytes);
    expect(r.headers["Content-Type"]).toBe("image/webp");
    expect(r.headers["Cache-Control"]).toMatch(/immutable/);
    expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("rejects a non-uuid instead of letting Postgres throw", async () => {
    const r = res();
    await getImage({ method: "GET", query: { id: "../../etc/passwd" } }, r);
    expect(r.code).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("404s a missing image", async () => {
    query.mockResolvedValue({ rows: [] });
    const r = res();
    await getImage({ method: "GET", query: { id: "11111111-1111-1111-1111-111111111111" } }, r);
    expect(r.code).toBe(404);
  });
});
