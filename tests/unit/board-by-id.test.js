import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the DB so the by-id handler's validation + auth can be tested without a
// real Postgres, following the health.test.js pattern.
const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { default: boardById } = await import("../../lib/handlers/board-by-id.js");

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

const ID = "00000000-0000-0000-0000-000000000001";

function localReq(method, id, body, overrides = {}) {
  return { method, query: { id }, headers: {}, socket: { remoteAddress: "127.0.0.1" }, body, ...overrides };
}

function remoteReq(method, id, body, overrides = {}) {
  return { method, query: { id }, headers: {}, socket: { remoteAddress: "203.0.113.7" }, body, ...overrides };
}

const ROW = {
  id: ID,
  title: "My Board",
  slug: "my-board",
  nodes: [],
  edges: [],
  type: "board",
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("/api/boards/:id (boardById)", () => {
  const orig = { NODE_ENV: process.env.NODE_ENV, LOCAL_DEV: process.env.LOCAL_DEV };
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.LOCAL_DEV;
    query.mockReset();
  });
  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    process.env.LOCAL_DEV = orig.LOCAL_DEV;
  });

  it("400 when id is missing", async () => {
    const res = mockRes();
    await boardById({ method: "GET", query: {}, headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it("400 for an invalid (non-uuid) id", async () => {
    const res = mockRes();
    await boardById(remoteReq("GET", "not-a-uuid"), res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  describe("GET (public)", () => {
    it("returns the row for a valid id", async () => {
      query.mockResolvedValueOnce({ rows: [ROW] });
      const res = mockRes();
      await boardById(remoteReq("GET", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(ROW);
    });

    it("404 when the row does not exist", async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const res = mockRes();
      await boardById(remoteReq("GET", ID), res);
      expect(res.statusCode).toBe(404);
    });

    it("does not require auth", async () => {
      query.mockResolvedValueOnce({ rows: [ROW] });
      const res = mockRes();
      await boardById(remoteReq("GET", ID), res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT (owner)", () => {
    it("401 when unauthorized", async () => {
      const res = mockRes();
      await boardById(remoteReq("PUT", ID, { title: "New" }), res);
      expect(res.statusCode).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });

    it("updates and returns the row", async () => {
      const updated = { ...ROW, title: "New Title" };
      query.mockResolvedValueOnce({ rows: [updated] });
      const res = mockRes();
      await boardById(localReq("PUT", ID, { title: "New Title" }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
    });

    it("404 when the row does not exist", async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const res = mockRes();
      await boardById(localReq("PUT", ID, { title: "New Title" }), res);
      expect(res.statusCode).toBe(404);
    });

    it("400 when title is too long", async () => {
      const res = mockRes();
      await boardById(localReq("PUT", ID, { title: "x".repeat(201) }), res);
      expect(res.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe("DELETE (owner)", () => {
    it("401 when unauthorized", async () => {
      const res = mockRes();
      await boardById(remoteReq("DELETE", ID), res);
      expect(res.statusCode).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });

    it("deletes and returns { deleted: true }", async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    it("returns { deleted: false } when nothing matched", async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ deleted: false });
    });
  });

  it("405 on other methods", async () => {
    const res = mockRes();
    await boardById(localReq("PATCH", ID), res);
    expect(res.statusCode).toBe(405);
  });
});
