import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { headersFor } from "../../lib/headers.js";

const vercel = JSON.parse(fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));

// serve.mjs no longer keeps its own copy of the header list - it reads
// vercel.json through lib/headers.js, so local/CI and prod cannot drift. These
// tests pin what that one list has to contain.
describe("headersFor (the vercel.json header list serve.mjs shares)", () => {
  it("sends the full security set on an ordinary page", () => {
    const h = headersFor("/");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["X-Permitted-Cross-Domain-Policies"]).toBe("none");
    expect(h["X-Robots-Tag"]).toBe("index, follow");
  });

  it("keeps the CSP strict: no unsafe-inline/unsafe-eval for scripts, no object-src, a form-action", () => {
    const csp = headersFor("/")["Content-Security-Policy"];
    const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  // An API response is not a page. "index, follow" on /api/* invited search
  // engines to index board JSON and raw image bytes.
  it("tells crawlers to stay out of /api/*", () => {
    expect(headersFor("/api/boards")["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headersFor("/api/images/11111111-1111-1111-1111-111111111111")["X-Robots-Tag"]).toBe("noindex, nofollow");
  });

  it("caches the hashed build output for a year and nothing else", () => {
    expect(headersFor("/assets/index-abc123.js")["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    expect(headersFor("/")["Cache-Control"]).toBeUndefined();
    expect(headersFor("/index.html")["Cache-Control"]).toBeUndefined();
  });

  it("covers every rule in vercel.json (nothing declared but unreachable)", () => {
    expect(vercel.headers.map((r) => r.source)).toEqual(["/(.*)", "/assets/(.*)", "/api/(.*)"]);
  });
});
