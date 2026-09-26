import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/auth-owner.js", () => ({ authorizeOwner: vi.fn(async () => true) }));
vi.mock("../../lib/rate-limit.js", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const { withErrors, guard } = await import("../../lib/wrap.js");
const { authorizeOwner } = await import("../../lib/auth-owner.js");
const { rateLimit } = await import("../../lib/rate-limit.js");

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    headersSent: false,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

beforeEach(() => {
  authorizeOwner.mockReset();
  authorizeOwner.mockResolvedValue(true);
  rateLimit.mockReset();
  rateLimit.mockReturnValue({ ok: true });
});

describe("withErrors", () => {
  it("passes a handler's own response straight through", async () => {
    const res = mockRes();
    const out = await withErrors(async (_req, r) => r.status(200).json({ ok: true }))({}, res);
    expect(res.statusCode).toBe(200);
    expect(out).toBe(res);
  });

  // The whole point of the wrapper: a throw inside a handler is a clean 500, not
  // a crashed function, and the error text never reaches the client.
  it("turns a thrown error into a 500 without leaking the message", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    await withErrors(async () => { throw new Error("connect ECONNREFUSED 10.0.0.9:5432"); })({}, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("500s a non-Error throw too", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    await withErrors(async () => { throw "boom"; })({}, res);
    expect(res.statusCode).toBe(500);
    err.mockRestore();
  });

  // A handler that already streamed bytes (GET /api/images/:id) cannot be given a
  // JSON body afterwards - writing one would throw a second time.
  it("does not try to respond when the handler already sent headers", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    res.headersSent = true;
    await withErrors(async () => { throw new Error("late"); })({}, res);
    expect(res.statusCode).toBe(0);
    expect(res.body).toBeNull();
    err.mockRestore();
  });
});

describe("guard", () => {
  it("405s a method that is not on the list, and sends nothing else", async () => {
    const res = mockRes();
    expect(await guard({ method: "DELETE" }, res, { methods: ["GET", "POST"] })).toBe(false);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method not allowed" });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("429s with a Retry-After when the bucket is spent", async () => {
    rateLimit.mockReturnValue({ ok: false, retryAfter: 42 });
    const res = mockRes();
    const opts = { key: "k", limit: 1, windowMs: 1000 };
    expect(await guard({ method: "GET" }, res, { limit: opts })).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "Rate limit exceeded" });
    expect(res.headers["Retry-After"]).toBe("42");
    expect(rateLimit).toHaveBeenCalledWith({ method: "GET" }, opts);
  });

  // An unauthenticated flood must cost the abuser its budget, not just a 401.
  it("spends the rate-limit budget BEFORE checking auth", async () => {
    authorizeOwner.mockResolvedValue(false);
    const res = mockRes();
    await guard({ method: "GET" }, res, { limit: { key: "k", limit: 1, windowMs: 1000 }, auth: "owner" });
    expect(rateLimit).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("401s when the owner check fails", async () => {
    authorizeOwner.mockResolvedValue(false);
    const res = mockRes();
    expect(await guard({ method: "GET" }, res, { auth: "owner" })).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("asks for allowBearer:false on an owner route and true on a bearer route", async () => {
    await guard({ method: "POST" }, mockRes(), { auth: "owner" });
    expect(authorizeOwner).toHaveBeenLastCalledWith({ method: "POST" }, { allowBearer: false });
    await guard({ method: "POST" }, mockRes(), { auth: "bearer" });
    expect(authorizeOwner).toHaveBeenLastCalledWith({ method: "POST" }, { allowBearer: true });
  });

  it("never touches the authorizer for a public route", async () => {
    const res = mockRes();
    expect(await guard({ method: "GET" }, res, { methods: ["GET"] })).toBe(true);
    expect(authorizeOwner).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it("treats a missing method as GET", async () => {
    const res = mockRes();
    expect(await guard({}, res, { methods: ["GET"] })).toBe(true);
    expect(await guard({}, mockRes(), { methods: ["POST"] })).toBe(false);
  });
});
