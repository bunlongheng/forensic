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
  const orig = {
    NODE_ENV: process.env.NODE_ENV,
    LOCAL_DEV: process.env.LOCAL_DEV,
    OWNER_USER_ID: process.env.OWNER_USER_ID,
  };
  beforeEach(() => {
    delete process.env.NODE_ENV;
    process.env.LOCAL_DEV = "true"; // the dev bypass is opt-in in every environment
    process.env.OWNER_USER_ID = "owner-1";
    query.mockReset();
  });
  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    process.env.LOCAL_DEV = orig.LOCAL_DEV;
    process.env.OWNER_USER_ID = orig.OWNER_USER_ID;
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
      expect(query).toHaveBeenCalledWith(expect.stringMatching(/AND trashed_at IS NULL/), [ID]);
    });

    it("404 when the row does not exist", async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const res = mockRes();
      await boardById(remoteReq("GET", ID), res);
      expect(res.statusCode).toBe(404);
    });

    it("404 when the row is trashed (excluded by AND trashed_at IS NULL)", async () => {
      query.mockResolvedValueOnce({ rows: [] }); // trashed rows never match the query
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
      const updated = { id: ID, title: "New Title", slug: "my-board", updated_at: ROW.updated_at };
      query.mockResolvedValueOnce({ rows: [updated] });
      const res = mockRes();
      await boardById(localReq("PUT", ID, { title: "New Title" }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(updated);
      expect(query).toHaveBeenCalledWith(expect.stringMatching(/AND trashed_at IS NULL/), expect.any(Array));
    });

    // Autosave fires this every 1100ms while editing. Echoing the whole board
    // back doubled the cost of every save; the client reads none of it.
    it("does NOT echo nodes/edges back - only what the client reads", async () => {
      query.mockResolvedValueOnce({ rows: [{ id: ID }] });
      await boardById(localReq("PUT", ID, { nodes: [], edges: [] }), mockRes());
      const [sql] = query.mock.calls[0];
      expect(sql).toContain("RETURNING id, title, slug, updated_at");
      expect(sql).not.toMatch(/RETURNING[^`]*\bnodes\b/);
      expect(sql).not.toMatch(/RETURNING[^`]*\bedges\b/);
    });

    it("404 when the row does not exist", async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const res = mockRes();
      await boardById(localReq("PUT", ID, { title: "New Title" }), res);
      expect(res.statusCode).toBe(404);
    });

    it("404 when the row is trashed (a non-restore PUT cannot touch it)", async () => {
      query.mockResolvedValueOnce({ rows: [] }); // WHERE ... AND trashed_at IS NULL excludes it
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

    it("writes a thumbnail-only PUT without touching nodes (so an oversized board still gets a card)", async () => {
      const res = mockRes();
      const thumbnail = "data:image/webp;base64,UklGRhoAAABXRUJQ";
      query.mockResolvedValueOnce({ rows: [{ id: ID }] });
      await boardById(localReq("PUT", ID, { thumbnail }), res);
      expect(res.statusCode).toBe(200);
      const [sql, values] = query.mock.calls[0];
      expect(sql).toContain("thumbnail = $1");
      expect(sql).not.toContain("nodes =");
      expect(values[0]).toBe(thumbnail);
    });

    it("a thumbnail-only PUT does NOT bump updated_at (no gallery reshuffle for a repaint)", async () => {
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [{ id: ID }] });
      await boardById(localReq("PUT", ID, { thumbnail: "data:image/webp;base64,UklGRhoAAABXRUJQ" }), res);
      expect(res.statusCode).toBe(200);
      expect(query.mock.calls[0][0]).not.toContain("updated_at = now()");
    });

    it("a content PUT still bumps updated_at", async () => {
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [{ id: ID }] });
      await boardById(localReq("PUT", ID, { title: "New", thumbnail: "data:image/webp;base64,UklGRhoAAABXRUJQ" }), res);
      expect(query.mock.calls[0][0]).toContain("updated_at = now()");
    });

    it("400 when a PUT carries no updatable field at all", async () => {
      const res = mockRes();
      await boardById(localReq("PUT", ID, {}), res);
      expect(res.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

    it("400 for a thumbnail that is not an image data URL", async () => {
      const res = mockRes();
      await boardById(localReq("PUT", ID, { thumbnail: "https://evil.example/x.png" }), res);
      expect(res.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

    it("400 for an oversized thumbnail", async () => {
      const res = mockRes();
      await boardById(localReq("PUT", ID, { thumbnail: `data:image/png;base64,${"A".repeat(400_001)}` }), res);
      expect(res.statusCode).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

    it("accepts null to clear the thumbnail", async () => {
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [{ id: ID }] });
      await boardById(localReq("PUT", ID, { thumbnail: null }), res);
      expect(res.statusCode).toBe(200);
      expect(query.mock.calls[0][1][0]).toBe(null);
    });
  });

  describe("DELETE (owner)", () => {
    it("401 when unauthorized", async () => {
      const res = mockRes();
      await boardById(remoteReq("DELETE", ID), res);
      expect(res.statusCode).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });

    it("hard-deletes a small board (<3 nodes) and returns { deleted: true }", async () => {
      query.mockResolvedValueOnce({ rows: [{ n: 1, trashed_at: null }] }); // node-count probe
      query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    it("soft-deletes a board with 3+ nodes to Trash and returns { trashed: true }", async () => {
      query.mockResolvedValueOnce({ rows: [{ n: 5, trashed_at: null }] }); // node-count probe
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE trashed_at
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ trashed: true });
    });

    it("a repeat non-purge DELETE on an ALREADY-trashed board is a no-op, not a hard delete", async () => {
      // A stale gallery tab sends the same "Move to Trash" request twice. The
      // second one used to fall through and destroy the board for good, while the
      // confirm dialog promised it could be restored.
      const res = mockRes();
      query.mockResolvedValueOnce({ rows: [{ n: 5, trashed_at: new Date() }] });
      await boardById(localReq("DELETE", ID), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ trashed: true });
      expect(query).toHaveBeenCalledTimes(1); // no second query = nothing was deleted
    });

    it("purge=1 hard-deletes even a large board", async () => {
      query.mockResolvedValueOnce({ rows: [{ n: 9, trashed_at: null }] });
      query.mockResolvedValueOnce({ rowCount: 1 });
      const res = mockRes();
      await boardById(localReq("DELETE", ID, undefined, { query: { id: ID, purge: "1" } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ deleted: true });
    });

    // board_images has no board_id and no cascade, so a purge that only removed
    // the boards row left every photo fetchable at /api/images/<uuid> forever,
    // cached immutable for a year by anyone who had opened the shared link.
    it("purge deletes the board's images too, scoped to the owner", async () => {
      const IMG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const IMG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      query.mockResolvedValueOnce({
        rows: [{
          n: 4,
          trashed_at: null,
          nodes: [
            { id: "1", data: { src: `/api/images/${IMG_A}` } },
            { id: "2", data: { src: `/api/images/${IMG_B}` } },
            { id: "3", data: { src: `/api/images/${IMG_A}` } }, // same photo twice
            { id: "4", data: { src: "data:image/png;base64,AAAA" } }, // legacy inline
            { id: "5", data: {} },
          ],
        }],
      });
      query.mockResolvedValueOnce({ rowCount: 2 }); // DELETE FROM board_images
      query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE FROM boards
      const res = mockRes();
      await boardById(localReq("DELETE", ID, undefined, { query: { id: ID, purge: "1" } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ deleted: true });
      const [imgSql, imgParams] = query.mock.calls[1];
      expect(imgSql).toContain("DELETE FROM board_images bi WHERE bi.user_id = $1");
      expect(imgSql).toContain("bi.id = ANY($2::uuid[])");
      expect(imgSql).toContain("NOT EXISTS"); // a photo another board still shows survives
      expect(imgParams[0]).toBe("owner-1");
      expect(imgParams[1]).toEqual([IMG_A, IMG_B]); // deduped, inline src ignored
      expect(imgParams[2]).toBe(ID);
      expect(query.mock.calls[2][0]).toBe("DELETE FROM boards WHERE id = $1");
    });

    it("skips the image delete when the board references none", async () => {
      query.mockResolvedValueOnce({ rows: [{ n: 1, trashed_at: null, nodes: [{ id: "1", data: {} }] }] });
      query.mockResolvedValueOnce({ rowCount: 1 });
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.body).toEqual({ deleted: true });
      expect(query).toHaveBeenCalledTimes(2);
    });

    it("a soft delete to Trash leaves the images alone (the board can come back)", async () => {
      query.mockResolvedValueOnce({
        rows: [{ n: 5, trashed_at: null, nodes: [{ id: "1", data: { src: "/api/images/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } }] }],
      });
      query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE trashed_at
      const res = mockRes();
      await boardById(localReq("DELETE", ID), res);
      expect(res.body).toEqual({ trashed: true });
      expect(query.mock.calls[1][0]).toContain("UPDATE boards SET trashed_at");
    });

    it("returns { deleted: false } when nothing matched", async () => {
      query.mockResolvedValueOnce({ rows: [] }); // board not found
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
