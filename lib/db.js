import pg from "pg";

const { Pool } = pg;

// Shared Linode Postgres (db "2026"), same instance the sibling diagrams /
// mindmaps apps use. Self-signed cert on the remote host, so verification is
// off by default when DATABASE_SSL=true - unless DATABASE_CA is set, in which
// case the connection is verified against that CA. Matches the diagrams app's
// lib/db.ts.
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

const pool = new Pool({
  connectionString: connectionString(),
  ssl: process.env.DATABASE_SSL === "true" ? sslConfig() : false,
  // Small pool: on Vercel each warm instance holds its own pool and traffic
  // is ~1 query/request, so a large pool risks exhausting the shared Postgres.
  max: 3,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});

export default pool;
