import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "../../lib/env.js";

// Every var validateEnv requires in production, set to a real-looking value so a
// single test can flip exactly one of them to its .env.example placeholder.
const REAL = {
  FORENSIC_API_SECRET: "7f3c1b9ad0e24c6fa1b8e5d2c4907a63",
  DATABASE_URL: "postgresql://forensic:pw@db.example.com:5432/forensic",
  OWNER_USER_ID: "11111111-2222-3333-4444-555555555555",
  GOOGLE_CLIENT_ID: "real-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "real-client-secret",
  AUTH_SECRET: "a94f2d7c0b6e1839f5a2c7d4e0b93165",
  OWNER_EMAIL: "owner@example.com",
};

const TRACKED = [...Object.keys(REAL), "NODE_ENV", "VERCEL_ENV", "VERCEL", "LOCAL_DEV"];

describe("validateEnv", () => {
  const orig = Object.fromEntries(TRACKED.map((k) => [k, process.env[k]]));
  beforeEach(() => {
    for (const k of TRACKED) delete process.env[k];
    Object.assign(process.env, REAL);
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    for (const k of TRACKED) {
      if (orig[k] === undefined) delete process.env[k];
      else process.env[k] = orig[k];
    }
  });

  it("passes with real values", () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it("is lenient outside production", () => {
    process.env.NODE_ENV = "test";
    process.env.FORENSIC_API_SECRET = "your-secret-token-here";
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).not.toThrow();
  });

  it("names every missing required var", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.OWNER_EMAIL;
    expect(() => validateEnv()).toThrow(/Missing required production env var\(s\): AUTH_SECRET, OWNER_EMAIL/);
  });

  // .env.example is public in the repo, so its example secret is public too.
  // Copying the file and running `npm run start` must fail, not serve.
  it("rejects the .env.example placeholder secret", () => {
    process.env.FORENSIC_API_SECRET = "your-secret-token-here";
    expect(() => validateEnv()).toThrow(/Placeholder .env.example value\(s\).*FORENSIC_API_SECRET/s);
  });

  it("rejects the placeholder owner email too, but not a localhost DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/forensic";
    process.env.OWNER_EMAIL = "you@example.com";
    expect(() => validateEnv()).toThrow(/value\(s\) still set in production: OWNER_EMAIL\./);
  });

  it("still rejects LOCAL_DEV on a Vercel deployment, before anything else", () => {
    process.env.VERCEL = "1";
    process.env.LOCAL_DEV = "true";
    expect(() => validateEnv()).toThrow(/LOCAL_DEV must not be set in production/);
  });

  it("validates a Vercel production build even when NODE_ENV is not production", () => {
    delete process.env.NODE_ENV;
    process.env.VERCEL_ENV = "production";
    delete process.env.OWNER_USER_ID;
    expect(() => validateEnv()).toThrow(/OWNER_USER_ID/);
  });
});
