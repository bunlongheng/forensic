# Security

## Reporting

Please report vulnerabilities privately via GitHub's "Report a vulnerability" on this repository, or by email to the address on the maintainer's profile. Do not open a public issue. You will get an acknowledgement within 72 hours.

## What is in place

- Strict Content-Security-Policy: no `unsafe-eval` or `unsafe-inline` for scripts, self-hosted fonts, workers and WASM.
- HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP and CORP on every response (`vercel.json`, mirrored in `serve.mjs`).
- Writes require the signed owner session (HMAC cookie, single allowed Google account) or the localhost dev bypass. The Bearer secret (`FORENSIC_API_SECRET`) authorizes only `POST /api/ai/boards` - it cannot list, update, or delete boards. Reads of a board by id are public by design (share links), except a trashed board, which reads 404.
- All SQL is parameterized. Request bodies are size-capped (4.5 MB) and validated. Rate limiting on the API - best-effort and per warm instance (in-memory), not a global guarantee across all instances/regions.
- The dev auth bypass is keyed on the TCP peer address, never the Host header, and is gated off in production unless `LOCAL_DEV` is set explicitly.
- No secrets in the repo; required env vars fail the build and the server fast (`lib/env.js`). `DATABASE_CA` turns on TLS certificate verification for Postgres when set.
