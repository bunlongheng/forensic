# <img src="docs/icon.png" width="36" height="36" align="top" alt=""> Forensic

An infinite, Figma-fast evidence board that lives in the browser.

Pin unlimited images, links, PDFs and notes, zoom without limits, and wire the connections with red threads - like a detective's evidence board, autosaved to Postgres with a local draft for crash safety. 17 evidence types, in-browser OCR, undo history, and a 1-click case report.

**Live:** https://forensic-bheng.vercel.app &middot; [Portfolio](https://bunlongheng.com/projects?name=forensic)

![Forensic board](docs/hero.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![React Flow](https://img.shields.io/badge/React%20Flow-12-ff0072)
![Postgres](https://img.shields.io/badge/Postgres-pg-4169e1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6b4ea8)


## Features

- **Infinite canvas** - pan and zoom without limits (0.02x to 40x), powered by React Flow.
- **Drop / paste / upload images** - drag image files onto the board, paste from the clipboard, or pick from disk. Large images are downscaled and re-encoded (WebP) so a board packed with photos stays fast.
- **Paste links, PDFs, audio and documents** - paste or drag in a URL, a PDF, an audio or video file or a document and it pins as an exhibit card; click its icon to open the real thing in a new tab. Files ride inside the board (max 2 MB each - pin a link to anything heavier).
- **Red threads** - drag from any node edge to wire it to as many others as you like. Threads attach to the nearest point on each card's boundary and light up when either end is selected.
- **Auto-thread** - multi-select assets and hit **Chain** (nearest-neighbour path) or **Fan** (biggest asset out to the rest).
- **Group / ungroup** - wrap a selection in a container so the whole set moves as one (`Cmd/Ctrl+G`, `Shift` to ungroup).
- **17 evidence types** - see the table below. Every node except the auto-height quick note resizes; most take a tint, photos take a caption, and the annotation ring supports lock and send-to-back.
- **In-browser OCR** - the case report runs tesseract.js over every pinned photo, self-hosted, zero API cost.
- **Case report** - one click renders the board as a readable report (images, notes, threads).
- **Undo / redo** - 100 steps of durable history, `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z`.
- **Autosave + crash safety** - debounced saves to Postgres, a fast local draft on this device, and a retry the moment the connection returns.
- **Boards** - a gallery of saved boards with live vector previews and a trash with restore.
- **Share** - copy a public read-only link to any board. Phones and touch devices always open read-only.
- **Light & dark** - the whole canvas + chrome theme together; your choice is remembered.

### Evidence types

| Type | What it is | Type | What it is |
|------|------------|------|------------|
| `image` | Pinned photo, torn edge, optional wrinkle + OCR | `note` | Sticky note with tint (legacy/API-created type - no menu tool) |
| `text` | Handwritten text block (Caveat) | `clip` | Paper-clipped quick note (auto height) |
| `callout` | Speech-bubble emphasis | `stamp` | Slanted or circle ink stamp (APPROVED, SECRET, ...) |
| `redaction` | Black bar | `marker` | Numbered crime-scene marker |
| `wax` | Wax seal | `crosshair` | Target crosshair |
| `spotlight` | Dims everything outside a circle | `annotation` | Hand-drawn ring |
| `drawing` | Freehand ink, in the add menu | `sticker` | Emoji sticker |
| `profile` | Person card (name + color) | `container` | Titled section that groups children |
| `file` | Link / PDF / audio / video / doc exhibit, opens in a new tab | | |

### Keyboard shortcuts

| Keys | Action |
|------|--------|
| Double-click canvas | Drop a quick note, already open for typing |
| `Cmd/Ctrl+S` | Save now |
| `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` | Undo / redo |
| `Cmd/Ctrl+C` | Copy the selection - a group brings its children and the wiring between the copied nodes |
| `Cmd/Ctrl+X` | Cut the selection, removing it and any threads attached to it |
| `Cmd/Ctrl+V` | Paste at the cursor, **on any board** - the clipboard survives switching boards (a file, SVG markup or a URL on the system clipboard always wins) |
| `Cmd/Ctrl+G` / `Cmd/Ctrl+Shift+G` | Group / ungroup the selection |
| `Shift` + drag | Snap a node into a straight line with the nodes it is wired to |
| `Backspace` / `Delete` | Remove the selection |

### Images

Image bytes live in their own `board_images` rows, not inside the board JSON. A
node stores `/api/images/<id>` - about 30 bytes - so a board is text again and
holds as many photos as you like. Each upload is its own request, which is what
keeps a 50-photo board from ever building a body big enough for the platform to
reject (Vercel caps a function request at 4.5 MB). Images are served with a
one-year immutable cache, so reopening a board costs nothing.

Boards saved before this still render untouched: a node's `src` is just a string,
and an inline `data:` URL and a `/api/images/<id>` URL both work. To lift the old
inline bytes out, run the migration - it backs up each board first and is
reversible:

```bash
node scripts/extract-board-images.mjs           # dry run, prints what it would move
node scripts/extract-board-images.mjs --write    # do it; originals go to backups/
node scripts/extract-board-images.mjs --restore backups/board-<id>.json
```

## Architecture

[![Forensic - Architecture](https://flows-bheng.vercel.app/api/flows/forensic-architecture?format=gif&w=3200)](https://flows-bheng.vercel.app/?id=a290832d-fe84-41d5-abf4-e116ed6fc170)

Interactive version: [Flows](https://flows-bheng.vercel.app/?id=a290832d-fe84-41d5-abf4-e116ed6fc170). How a pinned photo becomes a saved board: [sequence diagram](https://sequences-bheng.vercel.app/d/759ab379-ba1f-4378-b1ec-08f74322a00a).

- **`src/views/Board.jsx`** owns the canvas: React Flow wiring, selection, drag/drop/paste, the inspector.
- **`src/lib/boardGraph.js`** is the pure core - sanitize, group/ungroup, chain/fan threading, snap, z-order, edge styling. No React, fully unit-tested.
- **`src/hooks/`** hold the stateful concerns: `useBoardPersistence` (server autosave, local draft, online retry, `Cmd+S`, restore-on-open) and `useUndoRedo` (snapshot history + keys).
- **`src/components/`** are the node types plus the chrome (top bar, add menu, inspector, report modal).
- **`lib/handlers/`** are the API handlers. `api/*.js` (Vercel) and `serve.mjs` (local / CI) both import them, so there is one source of truth.
- The Board chunk is lazy-loaded: sign-in and the gallery never download React Flow or the node types.

### Persistence model

A board is `{ title, nodes[], edges[] }` in React Flow shape. Every change is reduced to a
**durable snapshot** (selection, drag and hover state stripped) and that string drives everything:

| Path | When | Where |
|------|------|-------|
| Local draft | 350 ms after any change | IndexedDB on this device |
| Server save | 1100 ms after any change, or `Cmd+S` | `PUT /api/boards/:id` |
| Online retry | The `online` event | Pushes the unconfirmed snapshot |
| Restore on open | Once per open | Draft newer than the server copy wins, then autosave pushes it |
| Undo history | Every snapshot | In memory, 100 entries |

### How a photo travels

[![Forensic - Image Pin and Autosave](https://sequences-bheng.vercel.app/svg/759ab379-ba1f-4378-b1ec-08f74322a00a)](https://sequences-bheng.vercel.app/d/759ab379-ba1f-4378-b1ec-08f74322a00a)


## Tech stack

- **Vite + React 19** SPA, **@xyflow/react** (React Flow) for the canvas
- **Express** prod-like server (`serve.mjs`) that mirrors the **Vercel** serverless functions in `api/`
- **Postgres** (`pg`) for board persistence, with a tiny idempotent migration runner
- **Google OAuth** owner sign-in (stateless HMAC session cookie); shared boards stay public to view
- **tesseract.js** for OCR, vendored under `public/tesseract` so the CSP needs no external host
- **Vitest** unit tests with a coverage ratchet + **Playwright** e2e against a production build
- Strict CSP (no `unsafe-eval`/`unsafe-inline` for scripts), HSTS, Permissions-Policy, rate limiting, fail-fast env validation

## Quick start

```bash
git clone https://github.com/bunlongheng/forensic.git
cd forensic
npm install
cp .env.example .env      # fill in DATABASE_URL etc. (LOCAL_DEV=true bypasses auth on localhost)
npm run migrate           # create the boards table
npm run dev               # Vite dev server on http://localhost:3036
npm run api               # (separate shell) the API server the dev proxy targets
```

Or run the exact production build locally:

```bash
npm run prod              # vite build + Express server serving dist/ + the API
```

## Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `DATABASE_SSL` | no | `"true"` for a remote Postgres |
| `DATABASE_CA` | no | PEM CA certificate; when set, Postgres TLS is verified instead of skipped |
| `FORENSIC_API_SECRET` | yes | Bearer token for `POST /api/ai/boards` (the only Bearer-auth route) |
| `OWNER_USER_ID` | yes | `boards.user_id` for API-created boards |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | Google OAuth web client |
| `AUTH_SECRET` | yes | Session-cookie signing secret |
| `OWNER_EMAIL` | yes | The only Google account allowed to sign in |
| `SESSION_MIN_IAT` | no | Unix seconds; sessions issued before this are rejected (rotate after a suspected leak) |
| `LOCAL_DEV` | no | Dev-only auth bypass on localhost / LAN. Never set in prod |
| `PORT` | no | Server port, default `4336` |

`lib/env.js` fails the build and the server fast when a required variable is missing - imported by both the Vite build and the server (`serve.mjs`). See `.env.example`.

## Testing

```bash
npm test                  # vitest unit tests + coverage (thresholds ratchet upward only)
npm run test:e2e          # Playwright: API + browser render against a prod build
npm run lint
```

CI (`.github/workflows/ci.yml`) runs lint, unit tests, migrations, and the e2e suite against
a throwaway Postgres on every push and pull request. `prod-monitor.yml` probes the live
health endpoint on a schedule.

## License

MIT - see [LICENSE](LICENSE).

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/-bunlongheng.com-3A3A3C?style=for-the-badge&amp;labelColor=2A2A2C&amp;logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y%2BmAAADAFBMVEXx8vLq6v%2F19fX09PT8%2Ff309PT5%2BfnAwMBMaXHx8vL19fX5%2Bfny8vL09PT39%2Ff6%2Bfn6%2Bvr09PTx8fH4%2BPn%2F8vLy8%2FP09PTz8%2FPy8vL%2F%2F%2F%2Fz9PTz9PP19fby8vP19PXz8%2FT19%2Fb08%2FTx8vLy8vL09vby8%2FL29vf19fTv8PDz9vb7%2Bvn%2F%2Ff%2F9%2Ff3w8vH29fb%2F%2FP339%2Ff5%2Bfn59%2Ff19PT09PR7rao3VF3%2F%2Fv8AKDR6sqsBV1vv8fL4%2BPiux8b8%2Bvq90NDy8%2FR%2BlpppnZyZqrACLTxclZJSkI9en5ssZ2luqaUAeWgqbW4BX1gCfG0%2Fa3QaVG0MN0UKNUKUpKsGpYMAKjoRQ1UDf3AQRloJqIgEm32d0cUBg3ElbnQIln8eVWgrmIdP0KzF5d5s2acdfHwppJCP5MMXl4Tz8%2FLv8%2FP39%2FiewL5%2BqahYf4IrTFZkk5KlxsREiIYAHiqDnKFmnJowc3IdVllvpKK7zc3D2tnk5%2BmuycdwpKKuub2yv8Ly%2B%2FkAMT7z%2Bvjq7e09gH93q6kGdWpGgoJZmJSlw8M7c3WwyceTw76w1M8mYmpFfX8lW2AFOEpGiYhxqqRrqaRb2rdIsZ8AVE91jpU7d3t3saqBoKhako4AWVEcUlg3aWwDupAHb2YwmIkPP1ERSVA7WmZ8tq8HT14oZW%2BYuLsMl3wQT10ROksENUc8Z3MJSGVLh4dqpJ%2BXr7U51awUgHM4v6ad1MkPuJZAiowVd3IEhnZH0aoYrI05p5sDtYwkzZ8EPViYxsRel5USbHAIgmwIM0gQamzU4uF2malQi4oWQFQ1zaYrp4UXlYwfiHoyxqFE1q4qeX4yn5JIxKkdrX1b1rAbWGvd5Oh91sRijpomsJEVc3Ukc34dqIcwuJVKwZIXkoQZcXlNv5g%2BqZUZvpNl2rPG9N0WkIoNqouW4sVPwp%2BM0b6h0ssfq4d%2F1r8hpo%2Fh9e4AamUjnI9avaBixqgklYWSwL4xtItUxplYl5qZ58mq78wMgnYXfnlOmJaR1L%2Bj78ny9fS%2FrXQPAAAAFXRSTlP7Brvx%2FsJhAgD87r4U72C4uGH8vhRDodYHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC6UlEQVQokS2Sd3BUVRSHb0KS3QRCiZw5t%2By9j33zXjZkyUs2uekhEAi9dwRCL4JUEQRFAQUs9A4WOopKU0GpFoqCBZUivaqoFKkWLIS5GX7%2FfnPO78yZj%2Fj8UTViK6HggvNgSGuluEZRKbZqlN9H%2FFWiWUzIFQK5fhjOIRTDoqv4ia86S4q3KSByHdSqIhxofBKr5iNxLMm2bQqWVkorJ%2BAkO46nkQJhceSRmCTDvKJIJBLJzMxMLU6POJ4eBPF1KpNEbdt2Cms4LCcnZ%2FX6D3d%2BsKJJ7VSlNLoqgbjUtmkKKxlVmpf3bsFXW3d1b77gueJAQIPQBCilkMKemNi23Ts9T35%2FaMe2rsvmTypylGUFCSIYWJLXrm2nUwOPfNO5w%2B73Okxnjqe0JigQEL3JizoeONr%2F2u99vju4fd1rdZnyspQmnGvAUBprWNqz348%2FhXN%2F6P1%2By4Uvs%2FJkpRQRwpJBRVn7vf16Dfitz5XevQqWt3yalXtKaRIUQmglWfsu5y7%2BMrDs0TMftWo1ZVy64xioOVpcIdt8%2Fvqvf9%2F859KJsrLmrzA%2BOKC0IkFEtJza7JOfr%2FYd0P9G98tdOxe0Hp9qJrOIBgDuOeEtp%2F%2B4d%2FvWX%2F%2F9u%2B%2FtlaUTmOWZg7SQEEyuFe52%2BML9O3cZO%2F5xl06zn2VcadOJUqJTzt7a82XfP7sx9vmGNm1m1MstV4IHCVAAoTLqL1372ddn%2Fz%2B2v%2FWq12c1fSpsaeQWAZAANntxzuI3e3zbo8XGpm%2FMnNqiXrh%2BljaPd6UUabkjps19tdGnX2zKb9b4pTFDCzOMLmYtpW5h%2BpCRTeYtyV%2BT36zx808OL4xYGoFrkqDTbJpSXLdRgwbPZL%2BQnT129OOPFVEEsAMJpHKdeKMJgJSAiALdjJANQKnRJI4R6boAKEwLCiGoBBegQjBftQo1KQWOlplFKSV9qGaF1NpAE7QQESTlMSy6pp%2F4%2FFFVYxMNRBTaiM0tkImxNaL8vgfDR8gvoYRaxgAAAABJRU5ErkJggg%3D%3D" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;&middot;&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
