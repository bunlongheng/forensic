import pg from "pg";

const { Pool } = pg;

// Shared Linode Postgres (db "2026"). The remote host presents a SELF-SIGNED
// cert, so with DATABASE_SSL=true and no DATABASE_CA the connection is encrypted
// but the server is NOT authenticated - anything on the path could terminate it.
// Set DATABASE_CA to that server cert's PEM (it is its own CA) to pin it and turn
// verification on; the boot warning below says so on every unverified prod start.
export function sslConfig() {
  if (process.env.DATABASE_CA) {
    return { ca: process.env.DATABASE_CA, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

// pg lets an `sslmode=` in the URL replace the ssl object above (dropping the CA),
// so DATABASE_SSL / DATABASE_CA are the single source of truth for TLS.
export function connectionString() {
  const raw = process.env.DATABASE_URL || "";
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}

const ssl = process.env.DATABASE_SSL === "true" ? sslConfig() : false;

// One warning at boot, not one per query: a production server running without a
// pinned CA should say so in its logs and name the lever that fixes it.
if (ssl && ssl.rejectUnauthorized === false && process.env.NODE_ENV === "production") {
  console.warn(
    "[db] DATABASE_CA is not set - TLS to Postgres is encrypted but UNVERIFIED. " +
      "Set DATABASE_CA to the server certificate PEM to pin it.",
  );
}

const pool = new Pool({
  connectionString: connectionString(),
  ssl,
  // Small pool: on Vercel each warm instance holds its own pool and traffic
  // is ~1 query/request, so a large pool risks exhausting the shared Postgres.
  max: 3,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});

export default pool;
