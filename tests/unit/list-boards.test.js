import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the DB so the list handler can be tested without a real Postgres,
// following the health.test.js pattern.
const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { default: listBoards } = await import("../../lib/handlers/list-boards.js");

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}

function localReq(overrides = {}) {
  return { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" }, ...overrides };
}

describe("GET /api/boards (listBoards)", () => {
  const orig = { NODE_ENV: process.env.NODE_ENV, LOCAL_DEV: process.env.LOCAL_DEV, OWNER_USER_ID: process.env.OWNER_USER_ID };
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.LOCAL_DEV;
    process.env.OWNER_USER_ID = "731ace87-64e5-44db-bf2a-82265f06f4d9";
    query.mockReset();
  });
  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    process.env.LOCAL_DEV = orig.LOCAL_DEV;
    process.env.OWNER_USER_ID = orig.OWNER_USER_ID;
  });

  it("405 on a non-GET method", async () => {
    const res = mockRes();
    await listBoards(localReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(query).not.toHaveBeenCalled();
  });

  it("401 when unauthorized (non-local, no bearer, no session)", async () => {
    const res = mockRes();
    await listBoards({ method: "GET", headers: {}, socket: { remoteAddress: "203.0.113.7" } }, res);
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the owner's rows, most recently updated first", async () => {
    const rows = [
      { id: "1", title: "B", updated_at: "2026-01-02T00:00:00.000Z" },
      { id: "2", title: "A", updated_at: "2026-01-01T00:00:00.000Z" },
    ];
    query.mockResolvedValueOnce({ rows });
    const res = mockRes();
    await listBoards(localReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(rows);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY updated_at DESC/), [
      "731ace87-64e5-44db-bf2a-82265f06f4d9",
    ]);
  });

  it("500 when OWNER_USER_ID is not configured", async () => {
    delete process.env.OWNER_USER_ID;
    const res = mockRes();
    await listBoards(localReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
