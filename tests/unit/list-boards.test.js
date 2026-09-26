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
    process.env.LOCAL_DEV = "true"; // the dev bypass is opt-in in every environment
    process.env.OWNER_USER_ID = "00000000-0000-0000-0000-000000000001";
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
      "00000000-0000-0000-0000-000000000001",
    ]);
  });

  // The WHERE and ORDER BY used to be template-literal ternaries - safe as
  // written, and exactly the shape the next runtime parameter turns into an
  // injection. Each branch is now one constant string; only $1 varies.
  it("picks a CONSTANT sql string per branch, with the owner as the only parameter", async () => {
    query.mockResolvedValue({ rows: [] });
    await listBoards(localReq(), mockRes());
    await listBoards(localReq({ query: { trash: "1" } }), mockRes());

    const [activeSql, activeParams] = query.mock.calls[0];
    const [trashSql, trashParams] = query.mock.calls[1];
    expect(activeSql).toContain("WHERE user_id = $1 AND trashed_at IS NULL");
    expect(activeSql).toContain("ORDER BY updated_at DESC LIMIT 100");
    expect(trashSql).toContain("WHERE user_id = $1 AND trashed_at IS NOT NULL");
    expect(trashSql).toContain("ORDER BY trashed_at DESC LIMIT 100");
    expect(activeParams).toEqual(["00000000-0000-0000-0000-000000000001"]);
    expect(trashParams).toEqual(["00000000-0000-0000-0000-000000000001"]);
    // No $2+: nothing else is interpolated OR parameterized into these queries.
    for (const sql of [activeSql, trashSql]) expect(sql).not.toMatch(/\$[2-9]/);
  });

  // 100 cards used to carry 100 full node+edge graphs. The gallery only needs the
  // graph when there is no thumbnail to draw instead.
  it("returns nodes/edges only for a board with no thumbnail, and always the counts", async () => {
    query.mockResolvedValue({ rows: [] });
    await listBoards(localReq(), mockRes());
    const [sql] = query.mock.calls[0];
    expect(sql).toContain("CASE WHEN thumbnail IS NULL THEN");
    expect(sql).toContain("END AS nodes");
    expect(sql).toContain("CASE WHEN thumbnail IS NULL THEN edges END AS edges");
    expect(sql).toContain("AS node_count");
    expect(sql).toContain("AS edge_count");
    // The inline base64 bytes never ride along, thumbnail or not.
    expect(sql).toContain("'hasImage':true".replace(/'/g, '"'));
  });

  it("500 when OWNER_USER_ID is not configured", async () => {
    delete process.env.OWNER_USER_ID;
    const res = mockRes();
    await listBoards(localReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
