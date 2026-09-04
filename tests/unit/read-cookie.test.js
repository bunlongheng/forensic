import { describe, it, expect } from "vitest";
import { readCookie } from "../../lib/auth-session.js";

describe("readCookie", () => {
  it("reads and decodes a named cookie", () => {
    expect(readCookie({ headers: { cookie: "a=1; fx_session=x%20y; b=2" } }, "fx_session")).toBe("x y");
  });
  it("returns null when absent", () => {
    expect(readCookie({ headers: {} }, "fx_session")).toBeNull();
  });
  it("treats a malformed percent-encoding as no cookie instead of throwing", () => {
    expect(readCookie({ headers: { cookie: "fx_session=%E0" } }, "fx_session")).toBeNull();
  });
});
