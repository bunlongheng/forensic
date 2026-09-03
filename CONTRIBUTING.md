# Contributing

Thanks for looking at Forensic. This is a small, focused codebase - keep changes small and focused too.

## Setup

```bash
npm install
cp .env.example .env      # DATABASE_URL + the auth vars; LOCAL_DEV=true for localhost
npm run migrate
npm run dev               # http://localhost:3036
npm run api               # separate shell: the API the dev proxy targets
```

## Before you open a PR

```bash
npm run lint              # ESLint, zero warnings
npm test                  # Vitest + coverage ratchet (thresholds only go up)
npm run test:e2e          # Playwright against a production build (needs Postgres)
npm audit                 # zero vulnerabilities
```

- Put pure logic in `src/lib/` (no React, no DOM) and unit-test it. Stateful concerns go in `src/hooks/`.
- New node types live in `src/components/`, get registered in `NODE_TYPES` in `src/views/Board.jsx`, and get a default size in `newNodeSpec` in `src/lib/boardGraph.js`.
- API changes go in `lib/handlers/` (one source of truth for Vercel and `serve.mjs`) and get an e2e test in `tests/e2e/api.spec.js`.
- Schema changes are a new timestamped file in `db/migrations/`. Never edit an applied migration.
- Match the existing style: 2-space indent, single quotes in `src/`, double quotes in `lib/` and tests, no semicolons in `src/`.

## Commits

Conventional prefixes: `feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `ci:`, `test:`, `docs:`. The last 4 skip the Vercel deploy. Bump `src/version.js` on user-visible changes.
