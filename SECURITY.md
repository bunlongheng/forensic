# Security

## Reporting

Please report vulnerabilities privately via GitHub's "Report a vulnerability" on this repository, or by email to bheng.code@gmail.com. Do not open a public issue. You will get an acknowledgement within 72 hours.

## Supported versions

Only the `main` branch / latest production deploy is supported. There are no maintained release branches.

## What is in place

- Strict Content-Security-Policy: no `unsafe-eval` or `unsafe-inline` for scripts, self-hosted fonts, workers and WASM.
- HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP and CORP on every response. `vercel.json` is the one source of truth; `serve.mjs` reads that same header list at boot (`lib/headers.js`) so local/CI can never drift from what Vercel actually sends. `/assets/*` also gets a one-year immutable cache, and `/api/*` gets `X-Robots-Tag: noindex, nofollow`.
- Writes require the signed owner session (HMAC cookie, single allowed Google account) or the localhost dev bypass. The Bearer secret (`FORENSIC_API_SECRET`) authorizes only `POST /api/ai/boards` - it cannot list, update, or delete boards, and it cannot upload images (`POST /api/images` is owner-session/local-dev only). Reads of a board by id are public by design (share links), except a trashed board, which reads 404.
- All SQL is parameterized. Request bodies are size-capped (4.5 MB) and validated. Rate limiting on the API - best-effort and per warm instance (in-memory), not a global guarantee across all instances/regions.
- The dev auth bypass is keyed on the TCP peer address, never the Host header, and is gated off in production unless `LOCAL_DEV` is set explicitly.
- No secrets in the repo; required env vars fail the build and the server fast (`lib/env.js`), which also refuses the `.env.example` placeholder values for `FORENSIC_API_SECRET` and `OWNER_EMAIL` in production - copying that file into prod fails loudly instead of running with a secret that is public in the repo. `DATABASE_CA` turns on TLS certificate verification for Postgres when set (the remote host is self-signed).
