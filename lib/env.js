// Fail-fast validation of the env vars the API needs in production. Imported by
// vite.config.js and serve.mjs so a misconfigured PRODUCTION build/server throws
// and FAILS instead of silently shipping a dead API. Mirrors diagrams' lib/env.ts.
//
// Required-var validation runs when NODE_ENV==="production" or
// VERCEL_ENV==="production" (covers both a locally-run production server and a
// real Vercel production build). The LOCAL_DEV=true check runs on ANY Vercel
// deployment (prod or preview). Local dev and CI are otherwise lenient.

// Load .env first so a local `npm run build` / `npm run prod` sees the same vars
// the server does. No-op on Vercel and CI, where the vars are real env.
import "dotenv/config";

const REQUIRED_IN_PRODUCTION = [
  "FORENSIC_API_SECRET",
  "DATABASE_URL",
  "OWNER_USER_ID",
  // Google owner sign-in (gates owner-only routes in prod).
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_SECRET",
  "OWNER_EMAIL",
];

// The literal values .env.example ships. Copying that file and starting a
// production server must fail loudly instead of running with a secret that is
// public in the repo.
const PLACEHOLDERS = {
  FORENSIC_API_SECRET: "your-secret-token-here",
  OWNER_EMAIL: "you@example.com",
};

export function validateEnv() {
  // The dev auth bypass must never be enabled on ANY Vercel deployment (prod or
  // preview) - it would open the admin-only routes. Checked before the
  // production-only early return below so a Vercel preview build also fails
  // the build, not just a production one.
  if (process.env.VERCEL && process.env.LOCAL_DEV === "true") {
    throw new Error("[env] LOCAL_DEV must not be set in production - it enables the dev auth bypass.");
  }

  if (process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production") return;

  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production env var(s): ${missing.join(", ")}. ` +
        `Set them in Vercel (Production) before deploying - the artifact API will not work without these.`,
    );
  }

  const placeholders = Object.keys(PLACEHOLDERS).filter((k) => process.env[k]?.trim() === PLACEHOLDERS[k]);
  if (placeholders.length > 0) {
    throw new Error(
      `[env] Placeholder .env.example value(s) still set in production: ${placeholders.join(", ")}. ` +
        `Replace them with real values - the example secret is public in the repo.`,
    );
  }
}

validateEnv();
