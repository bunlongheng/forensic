import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { default: unlock } = await import("../../lib/handlers/unlock.js");
const { hashPasscode } = await import("../../lib/passcode.js");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b ?? null; return this; },
  };
}

const ID = "00000000-0000-0000-0000-000000000001";
const req = (method, body, id = ID) => ({ method, query: { id }, headers: {}, socket: { remoteAddress: "203.0.113.7" }, body });

let hash;
beforeAll(async () => { hash = await hashPasscode("right"); });
beforeEach(() => query.mockReset());

describe("GET /api/boards/:id/unlock", () => {
  it("draws the lock screen for a locked board", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: ID, title: "Case", passcode_hash: hash, thumbnail: null }] });
    const res = mockRes();
    await unlock(req("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    for (const s of ["Protected board", "/icon-192.png", 'name="passcode"', "-webkit-text-security", 'class="alert hidden"']) {
      expect(res.body).toContain(s);
    }
  });

  it("sends an unlocked board straight to the app", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: ID, title: "Case", passcode_hash: null, thumbnail: null }] });
    const res = mockRes();
    await unlock(req("GET"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(`/?id=${ID}`);
  });

  it("404 for an unknown id, 400 for a bad one", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    let res = mockRes();
    await unlock(req("GET"), res);
    expect(res.statusCode).toBe(404);
    res = mockRes();
    await unlock(req("GET", undefined, "nope"), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/boards/:id/unlock", () => {
  const row = () => ({ rows: [{ id: ID, title: "Case", passcode_hash: hash, thumbnail: null }] });

  it("401 and the lock screen again on a wrong passcode", async () => {
    query.mockResolvedValueOnce(row());
    const res = mockRes();
    await unlock({ ...req("POST", { passcode: "nope" }), socket: { remoteAddress: "203.0.113.20" } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("Wrong passcode");
    expect(res.body).toContain('role="alert"');
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("303 to the reveal with an unlock cookie on the right passcode", async () => {
    query.mockResolvedValueOnce(row());
    const res = mockRes();
    await unlock({ ...req("POST", { passcode: " RIGHT " }), socket: { remoteAddress: "203.0.113.21" } }, res);
    expect(res.statusCode).toBe(303);
    expect(res.headers.Location.endsWith("&reveal=1")).toBe(true);
    expect(res.headers["Set-Cookie"].startsWith("forensic_unlock_")).toBe(true);
    expect(res.headers["Set-Cookie"]).toContain("HttpOnly");
  });

  it("reads a string body too", async () => {
    query.mockResolvedValueOnce(row());
    const res = mockRes();
    await unlock({ ...req("POST", "passcode=right"), socket: { remoteAddress: "203.0.113.22" } }, res);
    expect(res.statusCode).toBe(303);
  });

  it("404 for an unknown id", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await unlock({ ...req("POST", { passcode: "right" }), socket: { remoteAddress: "203.0.113.23" } }, res);
    expect(res.statusCode).toBe(404);
  });

  it("405 for other methods", async () => {
    const res = mockRes();
    await unlock(req("PUT"), res);
    expect(res.statusCode).toBe(405);
  });
});
