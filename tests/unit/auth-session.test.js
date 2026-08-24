import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signSession, verifySession, readCookie } from "../../lib/auth-session.js";

describe("session token sign/verify", () => {
  const orig = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-0123456789";
  });
  afterEach(() => {
    process.env.AUTH_SECRET = orig;
  });

  it("round-trips a payload", () => {
    const t = signSession({ email: "owner@example.com" });
    const s = verifySession(t);
    expect(s.email).toBe("owner@example.com");
    expect(s.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const t = signSession({ email: "owner@example.com" });
    const [data, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ email: "attacker@example.com", exp: 9999999999 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`)).toBe(null);
    expect(verifySession(`${data}.deadbeef`)).toBe(null);
  });

  it("rejects an expired token", () => {
    const t = signSession({ email: "owner@example.com" }, -10);
    expect(verifySession(t)).toBe(null);
  });

  it("rejects when signed with a different secret", () => {
    const t = signSession({ email: "owner@example.com" });
    process.env.AUTH_SECRET = "a-totally-different-secret";
    expect(verifySession(t)).toBe(null);
  });

  it("returns null for junk / missing tokens", () => {
    expect(verifySession(null)).toBe(null);
    expect(verifySession("not-a-token")).toBe(null);
  });

  it("includes iat in the signed payload", () => {
    const before = Math.floor(Date.now() / 1000);
    const t = signSession({ email: "owner@example.com" });
    const s = verifySession(t);
    expect(s.iat).toBeGreaterThanOrEqual(before);
    expect(s.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  describe("SESSION_MIN_IAT rotation lever", () => {
    const origMinIat = process.env.SESSION_MIN_IAT;
    afterEach(() => {
      if (origMinIat === undefined) delete process.env.SESSION_MIN_IAT;
      else process.env.SESSION_MIN_IAT = origMinIat;
    });

    it("a token signed now verifies with no SESSION_MIN_IAT set", () => {
      delete process.env.SESSION_MIN_IAT;
      const t = signSession({ email: "owner@example.com" });
      expect(verifySession(t)).not.toBe(null);
    });

    it("a token signed before SESSION_MIN_IAT no longer verifies", () => {
      const t = signSession({ email: "owner@example.com" });
      process.env.SESSION_MIN_IAT = String(Math.floor(Date.now() / 1000) + 1000);
      expect(verifySession(t)).toBe(null);
    });
  });
});

describe("readCookie", () => {
  it("extracts a named cookie", () => {
    const req = { headers: { cookie: "a=1; fx_session=abc.def; b=2" } };
    expect(readCookie(req, "fx_session")).toBe("abc.def");
    expect(readCookie(req, "missing")).toBe(null);
    expect(readCookie({ headers: {} }, "fx_session")).toBe(null);
  });
});
