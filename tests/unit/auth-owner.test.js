import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bearerOk, authorizeOwner, ownerId } from "../../lib/auth-owner.js";
import { signSession, sessionCookieName } from "../../lib/auth-session.js";

const SECRET = "test-secret-abc123";
const prodReq = (auth) => ({ headers: { host: "forensic-bheng.vercel.app", authorization: auth } });

describe("bearerOk (constant-time Bearer check)", () => {
  const orig = process.env.FORENSIC_API_SECRET;
  beforeEach(() => {
    process.env.FORENSIC_API_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.FORENSIC_API_SECRET = orig;
  });

  it("accepts the correct Bearer secret", () => {
    expect(bearerOk(prodReq(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong secret of the same length (no throw)", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(bearerOk(prodReq(`Bearer ${wrong}`))).toBe(false);
  });

  it("rejects a wrong-length token without throwing", () => {
    expect(() => bearerOk(prodReq("Bearer short"))).not.toThrow();
    expect(bearerOk(prodReq("Bearer short"))).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(bearerOk(prodReq(undefined))).toBe(false);
  });

  it("returns false when no secret is configured", () => {
    delete process.env.FORENSIC_API_SECRET;
    expect(bearerOk(prodReq(`Bearer ${SECRET}`))).toBe(false);
  });
});

describe("authorizeOwner", () => {
  const orig = { s: process.env.FORENSIC_API_SECRET, e: process.env.NODE_ENV, l: process.env.LOCAL_DEV };
  beforeEach(() => {
    process.env.FORENSIC_API_SECRET = SECRET;
    delete process.env.NODE_ENV;
    delete process.env.LOCAL_DEV;
  });
  afterEach(() => {
    process.env.FORENSIC_API_SECRET = orig.s;
    process.env.NODE_ENV = orig.e;
    process.env.LOCAL_DEV = orig.l;
  });

  it("allows a valid Bearer when allowBearer is true (default)", async () => {
    expect(await authorizeOwner(prodReq(`Bearer ${SECRET}`))).toBe(true);
  });

  it("REJECTS a valid Bearer when allowBearer is false (admin-only routes)", async () => {
    expect(await authorizeOwner(prodReq(`Bearer ${SECRET}`), { allowBearer: false })).toBe(false);
  });
});

describe("authorizeOwner CSRF defense in depth (session-cookie auth on state-changing methods)", () => {
  const orig = {
    s: process.env.AUTH_SECRET,
    o: process.env.OWNER_EMAIL,
    e: process.env.NODE_ENV,
    l: process.env.LOCAL_DEV,
  };
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-0123456789";
    process.env.OWNER_EMAIL = "owner@example.com";
    process.env.NODE_ENV = "production";
    delete process.env.LOCAL_DEV;
  });
  afterEach(() => {
    process.env.AUTH_SECRET = orig.s;
    process.env.OWNER_EMAIL = orig.o;
    process.env.NODE_ENV = orig.e;
    process.env.LOCAL_DEV = orig.l;
  });

  // host below is not localhost, so appOrigin() resolves secure:true - the
  // cookie name is the __Host- prefixed one.
  const cookieFor = (email) => `${sessionCookieName(true)}=${signSession({ email })}`;

  it("REJECTS a valid owner session on a state-changing method with cross-site fetch metadata and no matching Origin", async () => {
    const req = {
      method: "PUT",
      headers: {
        host: "forensic-bheng.vercel.app",
        cookie: cookieFor("owner@example.com"),
        "sec-fetch-site": "cross-site",
        origin: "https://evil.example.com",
      },
    };
    expect(await authorizeOwner(req, { allowBearer: false })).toBe(false);
  });

  it("allows a valid owner session on a state-changing method when sec-fetch-site is same-origin", async () => {
    const req = {
      method: "PUT",
      headers: {
        host: "forensic-bheng.vercel.app",
        cookie: cookieFor("owner@example.com"),
        "sec-fetch-site": "same-origin",
      },
    };
    expect(await authorizeOwner(req, { allowBearer: false })).toBe(true);
  });

  it("allows a valid owner session on a state-changing method when Origin matches the app origin", async () => {
    const req = {
      method: "DELETE",
      headers: {
        host: "forensic-bheng.vercel.app",
        "x-forwarded-proto": "https",
        cookie: cookieFor("owner@example.com"),
        origin: "https://forensic-bheng.vercel.app",
      },
    };
    expect(await authorizeOwner(req, { allowBearer: false })).toBe(true);
  });
});

describe("ownerId", () => {
  it("returns the trimmed OWNER_USER_ID or null", () => {
    const orig = process.env.OWNER_USER_ID;
    process.env.OWNER_USER_ID = "  00000000-0000-0000-0000-000000000001  ";
    expect(ownerId()).toBe("00000000-0000-0000-0000-000000000001");
    delete process.env.OWNER_USER_ID;
    expect(ownerId()).toBe(null);
    process.env.OWNER_USER_ID = orig;
  });
});
