import { describe, it, expect, beforeEach, afterEach } from "vitest";
import authMe from "../../lib/handlers/auth-me.js";
import { signSession, sessionCookieName } from "../../lib/auth-session.js";

// The req() host below is not localhost, so appOrigin() resolves secure:true -
// the cookie name is the __Host- prefixed one.
const COOKIE_NAME = sessionCookieName(true);

const OWNER_EMAIL = "owner@example.com";

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

function req(cookie) {
  return { method: "GET", headers: { host: "forensic-bheng.vercel.app", cookie } };
}

describe("GET /api/auth/me", () => {
  const orig = { a: process.env.AUTH_SECRET, o: process.env.OWNER_EMAIL };
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-0123456789";
    process.env.OWNER_EMAIL = OWNER_EMAIL;
  });
  afterEach(() => {
    process.env.AUTH_SECRET = orig.a;
    process.env.OWNER_EMAIL = orig.o;
  });

  it("with no cookie returns 200 { authenticated: false }", async () => {
    const res = mockRes();
    await authMe(req(undefined), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it("with a valid owner session cookie returns 200 { authenticated: true, email }", async () => {
    const cookie = `${COOKIE_NAME}=${signSession({ email: OWNER_EMAIL })}`;
    const res = mockRes();
    await authMe(req(cookie), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ authenticated: true, email: OWNER_EMAIL });
  });

  it("with a cookie for a non-owner email returns { authenticated: false }", async () => {
    const cookie = `${COOKIE_NAME}=${signSession({ email: "someone@else.com" })}`;
    const res = mockRes();
    await authMe(req(cookie), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });
});
