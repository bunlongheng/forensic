import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isLocal } from "../../lib/is-local.js";

// isLocal is based on the peer socket address, NOT the Host header (spoofable).
const req = (ip) => ({ socket: { remoteAddress: ip } });

describe("isLocal", () => {
  const orig = { NODE_ENV: process.env.NODE_ENV, LOCAL_DEV: process.env.LOCAL_DEV };
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.LOCAL_DEV;
  });
  afterEach(() => {
    process.env.NODE_ENV = orig.NODE_ENV;
    process.env.LOCAL_DEV = orig.LOCAL_DEV;
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

  it("is GATED OFF in production even for a loopback peer (unless LOCAL_DEV=true)", () => {
    process.env.NODE_ENV = "production";
    expect(isLocal(req("127.0.0.1"))).toBe(false);
    process.env.LOCAL_DEV = "true";
    expect(isLocal(req("127.0.0.1"))).toBe(true);
  });
});
