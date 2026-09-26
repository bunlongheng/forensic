import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isLocal } from "../../lib/is-local.js";

// isLocal is based on the peer socket address, NOT the Host header (spoofable).
const req = (ip) => ({ socket: { remoteAddress: ip } });

describe("isLocal", () => {
  const orig = { NODE_ENV: process.env.NODE_ENV, LOCAL_DEV: process.env.LOCAL_DEV, VERCEL: process.env.VERCEL };
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.VERCEL;
    // The bypass is opt-in everywhere now, so the "dev" baseline has to say so.
    process.env.LOCAL_DEV = "true";
  });
  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    process.env.LOCAL_DEV = orig.LOCAL_DEV;
    process.env.VERCEL = orig.VERCEL;
  });

  it("is true for loopback / LAN peers in dev", () => {
    expect(isLocal(req("127.0.0.1"))).toBe(true);
    expect(isLocal(req("::1"))).toBe(true);
    expect(isLocal(req("::ffff:127.0.0.1"))).toBe(true);
    expect(isLocal(req("192.168.1.20"))).toBe(true);
    expect(isLocal(req("10.0.0.5"))).toBe(true);
  });

  it("is false for a public peer address", () => {
    expect(isLocal(req("203.0.113.7"))).toBe(false);
    expect(isLocal(req(undefined))).toBe(false);
  });

  it("does NOT trust the Host header (spoofable)", () => {
    expect(isLocal({ headers: { host: "localhost" }, socket: { remoteAddress: "203.0.113.7" } })).toBe(false);
  });

  // `node serve.mjs` behind a reverse proxy sees every internet request arrive
  // from 127.0.0.1. Without an explicit opt-in that handed the whole internet
  // owner rights, and NODE_ENV is not set by `npm run api`.
  it("is OFF without LOCAL_DEV=true, in every environment", () => {
    delete process.env.LOCAL_DEV;
    expect(isLocal(req("127.0.0.1"))).toBe(false);
    expect(isLocal(req("192.168.1.20"))).toBe(false);
    process.env.LOCAL_DEV = "1"; // only the exact string counts
    expect(isLocal(req("127.0.0.1"))).toBe(false);
    process.env.NODE_ENV = "production";
    delete process.env.LOCAL_DEV;
    expect(isLocal(req("127.0.0.1"))).toBe(false);
  });

  it("is GATED OFF in production unless LOCAL_DEV=true", () => {
    process.env.NODE_ENV = "production";
    delete process.env.LOCAL_DEV;
    expect(isLocal(req("127.0.0.1"))).toBe(false);
    process.env.LOCAL_DEV = "true";
    expect(isLocal(req("127.0.0.1"))).toBe(true);
  });

  it("is GATED OFF on any Vercel deployment, even with LOCAL_DEV=true", () => {
    process.env.VERCEL = "1";
    process.env.LOCAL_DEV = "true";
    expect(isLocal(req("127.0.0.1"))).toBe(false);
  });
});
