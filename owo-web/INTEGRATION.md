# Owó Reach — frontend ↔ backend integration

This app talks to the `owo-reach` backend (Bun + Hono) over `/api/*`.

## Running it

1. Start the backend first, on its default port:
   ```
   cd owo-reach   # the backend repo
   bun run dev    # listens on :3000
   ```
2. In this frontend, install and run:
   ```
   npm install
   npm run dev
   ```
   Vite's dev server proxies every `/api/*` request to `http://localhost:3000`
   (see `vite.config.js`), so no CORS setup was needed on the backend at all.
   In production, the backend serves this app's build output itself — same
   origin, same story, zero proxy config required.

## What's wired up

| Screen | Backend endpoints |
|---|---|
| **Home** (`/home`) | `GET /api/runs` (recent runs), `POST /api/runs` (create + AI ingestion), live `ingestion.*` / `run.created` SSE events for progress |
| **Review** (`/review/:runId`) | `GET /api/runs/:id`, `POST /api/runs/:id/approve` |
| **Live batch** (`/batch/:runId`) | `GET /api/runs/:id`, `POST /api/beneficiaries/:id/otp`, `.../otp/resend`, `.../reveal`, `.../cancel`, `.../reissue`, `.../nudge`, plus the live `GET /api/events` SSE wire for real-time state |
| **Audit** (`/audit/:runId`) | `GET /api/runs/:id` (receipt + trail built from real events; export is a client-side download, no backend endpoint for this exists) |
| **Transactions** (`/transactions`) | `GET /api/runs` + `GET /api/runs/:id` per run, flattened into one ledger client-side |
| **Settings** | `GET /api/health` only — the API has no org/profile/key-management endpoints, so this page says so instead of faking saves |

## Things worth knowing

- **Sign in / Sign up** are still a cosmetic gate (no `/api/auth/*` exists on
  the backend) — they just navigate to `/home`.
- **Toasts** (`src/lib/toast.jsx`) surface every API error and success,
  including a specific message when the backend is unreachable at all.
- **Live updates** come from a single `EventSource` per page
  (`src/lib/useLiveEvents.js`) subscribed to `/api/events`. On any relevant
  event the page re-fetches the run rather than hand-merging partial SSE
  payloads — simpler and correct at this product's scale.
- All money is formatted from the integer-kobo values the API returns
  (`src/lib/money.js`) — no client-side money math, only formatting.
