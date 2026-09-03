# Security

## Reporting

Please report vulnerabilities privately via GitHub's "Report a vulnerability" on this repository, or by email to the address on the maintainer's profile. Do not open a public issue. You will get an acknowledgement within 72 hours.

## What is in place

- Strict Content-Security-Policy: no `unsafe-eval` or `unsafe-inline` for scripts, self-hosted fonts, workers and WASM.
- HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP and CORP on every response (`vercel.json`, mirrored in `serve.mjs`).
- Writes require the signed owner session (HMAC cookie, single allowed Google account) or the Bearer secret for the render-only API. Reads of a board by id are public by design (share links).
- All SQL is parameterized. Request bodies are size-capped and validated. Rate limiting on the API.
- The dev auth bypass is keyed on the TCP peer address, never the Host header, and is gated off in production unless `LOCAL_DEV` is set explicitly.
- No secrets in the repo; required env vars fail the build and the server fast (`lib/env.js`).
