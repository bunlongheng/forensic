import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the DB so the create handler's validation + auth can be tested without a
// real Postgres, following the health.test.js pattern.
const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { default: createBoard } = await import("../../lib/handlers/create-board.js");

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

// isLocal(req) is driven by req.socket.remoteAddress; 127.0.0.1 with no
// NODE_ENV set authorizes the request as the owner (dev bypass).
function localReq(body, overrides = {}) {
  return { method: "POST", headers: {}, socket: { remoteAddress: "127.0.0.1" }, body, ...overrides };
}

function remoteReq(body, overrides = {}) {
  return { method: "POST", headers: {}, socket: { remoteAddress: "203.0.113.7" }, body, ...overrides };
}

const ROW = {
  id: "731ace87-64e5-44db-bf2a-82265f06f4d9",
  title: "Untitled Board",
  slug: "untitled-board",
  nodes: [],
  edges: [],
  type: "board",
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("POST /api/boards (createBoard)", () => {
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

  it("405 on a non-POST method", async () => {
    const res = mockRes();
    await createBoard({ method: "GET", headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(query).not.toHaveBeenCalled();
  });

  it("401 when not authorized (non-local, no bearer, no session)", async () => {
    const res = mockRes();
    await createBoard(remoteReq({ title: "X" }), res);
    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("happy path: inserts and returns 201 with the full row", async () => {
    query.mockResolvedValueOnce({ rows: [] }); // slug lookup: no collisions
    query.mockResolvedValueOnce({ rows: [ROW] }); // insert
    const res = mockRes();
    await createBoard(localReq({ title: "Untitled Board" }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(ROW);
  });

  it("defaults title/nodes/edges/type when body fields are omitted", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [ROW] });
    const res = mockRes();
    await createBoard(localReq({}), res);
    expect(res.statusCode).toBe(201);
    const insertCall = query.mock.calls[1];
    expect(insertCall[1]).toEqual([
      "731ace87-64e5-44db-bf2a-82265f06f4d9",
      "Untitled Board",
      "untitled-board",
      "[]",
      "[]",
      "board",
      [],
    ]);
  });

  it("400 when title exceeds 200 characters", async () => {
    const res = mockRes();
    await createBoard(localReq({ title: "x".repeat(201) }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/title too long/i);
    expect(query).not.toHaveBeenCalled();
  });

  it("400 when nodes is not an array", async () => {
    const res = mockRes();
    await createBoard(localReq({ nodes: "nope" }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/nodes must be an array/i);
  });

  it("400 when a node has no string id", async () => {
    const res = mockRes();
    await createBoard(localReq({ nodes: [{ position: { x: 0, y: 0 } }] }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/string id/i);
  });

  it("400 when an edge is missing source/target", async () => {
    const res = mockRes();
    await createBoard(localReq({ edges: [{ source: "a" }] }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/source.*target/i);
  });

  it("400 when nodes exceed 1000", async () => {
    const nodes = Array.from({ length: 1001 }, (_, i) => ({ id: String(i) }));
    const res = mockRes();
    await createBoard(localReq({ nodes }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/too many nodes/i);
  });

  it("500 when OWNER_USER_ID is not configured", async () => {
    delete process.env.OWNER_USER_ID;
    const res = mockRes();
    await createBoard(localReq({ title: "X" }), res);
    expect(res.statusCode).toBe(500);
  });
});
