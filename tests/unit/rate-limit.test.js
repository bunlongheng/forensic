import { describe, it, expect } from "vitest";
import { rateLimit } from "../../lib/rate-limit.js";

function req(ip) {
  return { headers: { "x-forwarded-for": ip }, socket: {} };
}

describe("rateLimit", () => {
  it("allows up to `limit` calls for a given key+ip, then blocks with a retryAfter", () => {
    const opts = { key: "test-a", limit: 3, windowMs: 60000 };
    const r = req("1.1.1.1");

    expect(rateLimit(r, opts)).toEqual({ ok: true });
    expect(rateLimit(r, opts)).toEqual({ ok: true });
    expect(rateLimit(r, opts)).toEqual({ ok: true });

    const blocked = rateLimit(r, opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("gives different ips independent buckets", () => {
    const opts = { key: "test-b", limit: 1, windowMs: 60000 };
    expect(rateLimit(req("2.2.2.2"), opts)).toEqual({ ok: true });
    expect(rateLimit(req("2.2.2.2"), opts).ok).toBe(false);
    // A different ip is unaffected by the first ip's usage.
    expect(rateLimit(req("3.3.3.3"), opts)).toEqual({ ok: true });
  });

  it("gives different keys independent buckets for the same ip", () => {
    const r = req("4.4.4.4");
    expect(rateLimit(r, { key: "test-c1", limit: 1, windowMs: 60000 })).toEqual({ ok: true });
    // Using the same ip but a different key should not be affected by test-c1's usage.
    expect(rateLimit(r, { key: "test-c2", limit: 1, windowMs: 60000 })).toEqual({ ok: true });
  });

  it("uses the LAST hop of a multi-hop x-forwarded-for (the earlier hops are client-spoofable)", () => {
    const opts = { key: "test-d", limit: 1, windowMs: 60000 };
    const r = { headers: { "x-forwarded-for": "9.9.9.9, 5.5.5.5" }, socket: {} };
    expect(rateLimit(r, opts)).toEqual({ ok: true });
    // The bucket is keyed on 5.5.5.5 (last hop), so a request whose XFF ends
    // in the same last hop shares the bucket even with a different first hop.
    expect(rateLimit({ headers: { "x-forwarded-for": "1.1.1.1, 5.5.5.5" }, socket: {} }, opts).ok).toBe(false);
  });
});
