import { authorizeOwner } from "./auth-owner.js";
import { rateLimit } from "./rate-limit.js";

// Wraps a handler so any thrown error becomes a clean 500 instead of a crash.
export function withErrors(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api] unhandled error:", msg);
      if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
    }
  };
}

// The method / rate-limit / auth preamble every handler used to hand-roll.
// Returns true when the request may proceed; when it returns false the response
// has ALREADY been sent, with the exact status and body the handlers used to
// send themselves.
//   methods: allowed HTTP methods            -> 405 { error: "Method not allowed" }
//   limit:   { key, limit, windowMs }        -> 429 { error: "Rate limit exceeded" } + Retry-After
//   auth:    "public" | "owner" | "bearer"   -> 401 { error: "Unauthorized" }
//            "owner" is the signed-in owner or local dev; "bearer" additionally
//            accepts the agent key (POST /api/ai/boards only).
// The limit is checked BEFORE auth on purpose: an unauthenticated flood must
// cost the abuser its budget, not just a 401 per request.
export async function guard(req, res, { methods, limit, auth = "public" } = {}) {
  if (methods && !methods.includes((req.method || "GET").toUpperCase())) {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  if (limit) {
    const limited = rateLimit(req, limit);
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfter));
      res.status(429).json({ error: "Rate limit exceeded" });
      return false;
    }
  }
  if (auth !== "public" && !(await authorizeOwner(req, { allowBearer: auth === "bearer" }))) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
