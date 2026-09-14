import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "../../lib/rate-limit.js";

// Off Vercel there is no trusted edge in front of us, so forwarded-for headers
// are whatever the caller typed. The limiter must key on the socket peer.
const peer = (ip, headers = {}) => ({ headers, socket: { remoteAddress: ip } });

describe("rateLimit (no trusted proxy - serve.mjs, bare node)", () => {
  it("allows up to `limit` calls for a given key+ip, then blocks with a retryAfter", () => {
    const opts = { key: "test-a", limit: 3, windowMs: 60000 };
    const r = peer("1.1.1.1");
    expect(rateLimit(r, opts)).toEqual({ ok: true });
    expect(rateLimit(r, opts)).toEqual({ ok: true });
    expect(rateLimit(r, opts)).toEqual({ ok: true });

    const blocked = rateLimit(r, opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("gives different ips independent buckets", () => {
    const opts = { key: "test-b", limit: 1, windowMs: 60000 };
    expect(rateLimit(peer("2.2.2.2"), opts)).toEqual({ ok: true });
    expect(rateLimit(peer("2.2.2.2"), opts).ok).toBe(false);
    expect(rateLimit(peer("3.3.3.3"), opts)).toEqual({ ok: true });
  });

  it("gives different keys independent buckets for the same ip", () => {
    const r = peer("4.4.4.4");
    expect(rateLimit(r, { key: "test-c1", limit: 1, windowMs: 60000 })).toEqual({ ok: true });
    expect(rateLimit(r, { key: "test-c1", limit: 1, windowMs: 60000 }).ok).toBe(false);
    expect(rateLimit(r, { key: "test-c2", limit: 1, windowMs: 60000 })).toEqual({ ok: true });
  });

  // The bug this guards: rotating a spoofed header handed every request its own
  // bucket, so a 20/min cap took 24 straight requests without a single 429.
  it("IGNORES client-supplied x-real-ip / x-forwarded-for and keys on the socket", () => {
    const opts = { key: "test-spoof", limit: 2, windowMs: 60000 };
    expect(rateLimit(peer("9.9.9.9", { "x-real-ip": "203.0.113.1" }), opts).ok).toBe(true);
    expect(rateLimit(peer("9.9.9.9", { "x-real-ip": "203.0.113.2" }), opts).ok).toBe(true);
    // Same socket, a third invented ip - still the same bucket, still blocked.
    expect(rateLimit(peer("9.9.9.9", { "x-real-ip": "203.0.113.3" }), opts).ok).toBe(false);
    expect(rateLimit(peer("9.9.9.9", { "x-forwarded-for": "203.0.113.4" }), opts).ok).toBe(false);
  });
});

describe("rateLimit (on Vercel - the edge rewrites the headers)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("trusts x-vercel-forwarded-for, and the LAST hop of x-forwarded-for", async () => {
    vi.stubEnv("VERCEL", "1");
    const { rateLimit: limited } = await import("../../lib/rate-limit.js?vercel");
    const opts = { key: "test-vercel", limit: 1, windowMs: 60000 };

    expect(limited({ headers: { "x-vercel-forwarded-for": "8.8.8.8" }, socket: {} }, opts).ok).toBe(true);
    expect(limited({ headers: { "x-vercel-forwarded-for": "8.8.8.8" }, socket: {} }, opts).ok).toBe(false);
    // Earlier hops are client-supplied; only the hop our own edge appended counts.
    expect(limited({ headers: { "x-forwarded-for": "9.9.9.9, 5.5.5.5" }, socket: {} }, opts).ok).toBe(true);
    expect(limited({ headers: { "x-forwarded-for": "1.1.1.1, 5.5.5.5" }, socket: {} }, opts).ok).toBe(false);
  });
});
