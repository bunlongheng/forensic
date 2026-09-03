// Best-effort in-memory fixed-window rate limiter. Serverless functions have
// no shared store across instances, so this only bounds abuse PER INSTANCE
// (e.g. a warm Vercel lambda or the long-lived serve.mjs process) - it is not
// a global guarantee across all instances/regions. Good enough to blunt a
// single abusive client hitting a warm function repeatedly.
const buckets = new Map();

// Opportunistic eviction threshold: a long-lived process (serve.mjs) never
// naturally shrinks this Map, so once it grows past this size we sweep out
// expired entries. O(n) only on the occasional sweep, not on every call.
const SWEEP_THRESHOLD = 5000;

function sweepExpired(now) {
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

// rateLimit(req, { key, limit, windowMs }) -> { ok, retryAfter? }
//
// Client key precedence: x-vercel-forwarded-for (set by Vercel's edge, not
// spoofable by the client) > x-real-ip > the LAST hop of x-forwarded-for
// (the first hops are client-supplied and spoofable; the last hop is the one
// our own reverse proxy appended) > the raw socket address.
export function rateLimit(req, { key, limit, windowMs }) {
  const xff = req.headers?.["x-forwarded-for"];
  const ip =
    req.headers?.["x-vercel-forwarded-for"] ||
    req.headers?.["x-real-ip"] ||
    xff?.split(",").pop()?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const bucketKey = `${key}:${ip}`;

  const now = Date.now();
  if (buckets.size > SWEEP_THRESHOLD) sweepExpired(now);
  let bucket = buckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true };
}
