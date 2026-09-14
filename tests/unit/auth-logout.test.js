import { describe, it, expect } from "vitest";
import authLogout from "../../lib/handlers/auth-logout.js";

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

function req() {
  return { method: "POST", headers: { host: "forensic-bheng.vercel.app" } };
}

describe("POST /api/auth/logout", () => {
  // Vercel routes every method to the same function, so without a guard a plain
  // GET cleared the cookie - an <img> tag anywhere could sign the owner out.
  it("405s a GET and leaves the cookie alone", async () => {
    const res = mockRes();
    await authLogout({ ...req(), method: "GET" }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("returns 200 and clears the session cookie (__Host- prefixed since the request is not local/http)", async () => {
    const res = mockRes();
    await authLogout(req(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const setCookie = res.headers["Set-Cookie"];
    expect(setCookie).toMatch(/^__Host-fx_session=/);
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
