# Deployment (Vercel + Supabase)

## Vercel project (monorepo root)

Use **one** Vercel project for the static site and the serverless API. Settings in root **`vercel.json`** are the source of truth; match the dashboard to them or turn **off** framework overrides so that file applies.

| Setting | Value | Notes |
|--------|--------|--------|
| Root Directory | `.` (repo root) | Do **not** set `apps/api`. Root `npm run build` builds the web app; `apps/api` only runs a no-op `build` and skips Vite. |
| Framework | **Vite** or **Other** | Do **not** use the **Express** preset for this project — it expects `index.js` / `app.js` inside the output directory; Vite emits static `index.html` + assets. |
| Build Command | `npm run build` | Root script runs `npm run build -w web`. |
| Output Directory | `dist/apps/web` | Matches `apps/web` Vite `--outDir ../../dist/apps/web`. |
| Install Command | `npm install --include=dev` | Ensures devDependencies (e.g. Vite) exist during build. |

Serverless Express lives at **`api/index.mjs`** (repo root). You do not need a second Vercel project rooted at `apps/api` for the default setup.

## Environment variables

### Never set in production

- `VITE_DEV_MOCKS` — enables PocketBase-shaped mocks in the web app (development only).
- `DEV_MOCKS` — enables API PocketBase mocks (`apps/api`).

Use `npm run dev:mocks` locally instead of committing these flags.

### Vercel (frontend static build + API serverless)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Build / client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Build / client | Supabase anon (public) key |
| `VITE_API_BASE_URL` | Optional | Override API base; default production base is `/api` |
| `CORS_ORIGIN` | Optional (serverless) | If unset on Vercel, CORS allows **`https://` + `VERCEL_URL`** (set automatically). Add this when you use a **custom domain** or multiple origins (comma-separated). |
| `GEMINI_API_KEY` | Serverless only | AI routes — set on Vercel for `api/` functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless only | Bypass RLS for trusted server logic — **never** prefix with `VITE_` |

Vercel sets `VERCEL=1`; the Express app does not call `listen()` and is mounted via `api/index.mjs` + `serverless-http`.

### Local API (non-Vercel)

- `WEBSITE_DOMAIN`, `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD` when talking to real PocketBase.
- `SUPABASE_*` when you begin migrating `apps/api` data access off PocketBase.

## Database

1. Create a Supabase project.
2. Apply SQL under `supabase/migrations/` (CLI: `supabase link` then `supabase db push`, or paste into the SQL editor in order).

## GitHub

Ensure `.env` files are gitignored (see root `.gitignore`). Rotate any key that was ever committed.
