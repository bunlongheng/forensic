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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? sslConfig() : false,
  // Small pool: on Vercel each warm instance holds its own pool and traffic
  // is ~1 query/request, so a large pool risks exhausting the shared Postgres.
  max: 3,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
});

export default pool;
