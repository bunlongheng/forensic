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
