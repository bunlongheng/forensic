# Contributing

Thanks for looking at Forensic. This is a small, focused codebase - keep changes small and focused too.

## Setup

```bash
nvm use                   # Node 22, from .nvmrc
npm install
cp .env.example .env      # DATABASE_URL + the auth vars; LOCAL_DEV=true for localhost
                           # (must be set explicitly - it is opt-in in every environment)
npm run migrate
npm run dev               # http://localhost:3036
npm run api               # separate shell: the API the dev proxy targets
```

## Before you open a PR

```bash
npm run lint              # ESLint, zero warnings - covers .js/.jsx AND .mjs
npm test                  # Vitest + coverage ratchet (thresholds only go up)
npm run test:e2e          # Playwright against a production build (needs Postgres) - keeps a trace on failure
npm audit                 # zero vulnerabilities
```

- Put pure logic in `src/lib/` (no React, no DOM) and unit-test it. Stateful concerns go in `src/hooks/`.
- New node types live in `src/components/`. `src/lib/nodeRegistry.js` is the single source of truth: add 1 entry there (`label`, `resizes`, `inspector`, `spec`, `tool`), register the renderer in `src/lib/nodeTypes.js` (the React Flow component map), and add its panel to `Inspector.jsx`. `tests/unit/nodeRegistry.test.js` enforces that every derived list (React Flow's component map, the tool ring, default specs) stays in step with the registry, so a type can never render with no inspector or sit in the ring with no defaults.
- API changes go in `lib/handlers/` (one source of truth for Vercel and `serve.mjs`) and get an e2e test in `tests/e2e/api.spec.js`. See `docs/api.md` for the full route table.
- Every new API route must be registered in both `api/*.js` (Vercel) and `serve.mjs` (local / CI) - one handler, two wire-ups.
- Schema changes are a new timestamped file in `db/migrations/`. Never edit an applied migration. Migrations run automatically on the Vercel production build (`vercel.json` buildCommand), before the new code goes live and with no rollback - so every migration must be additive/expand-only (new columns nullable or defaulted); drop a column only in a later release once no deployed code reads it.
- Match the existing style: 2-space indent, single quotes in `src/`, double quotes in `lib/` and tests, no semicolons in `src/`.

## Commits

Conventional prefixes: `feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `ci:`, `test:`, `docs:`. The last 4 skip the Vercel deploy (`vercel.json` ignoreCommand). Bump `version.js` on user-visible changes.
