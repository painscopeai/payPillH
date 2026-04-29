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

### Troubleshooting Vercel builds

- **Build log shows `api@0.0.0 build` instead of `web@` / `vite build`** — The project **Root Directory** is still **`apps/api`** (or only that app is being built). Set **Root Directory** to **`.`** (repository root) so root `vercel.json` applies and `npm run build` runs `npm run build -w web`. The `apps/api` `build` script delegates to the root build as a safety net, but **`api/index.mjs` only deploys when the Vercel root is the repo** (the `api/` folder must sit at the project root Vercel sees).
- **`No Output Directory named "web"`** — Usually means **`vercel.json` was not applied** (wrong root) or the dashboard **Output Directory** override does not match **`dist/apps/web`**. Fix root directory first; then clear overrides or set output to **`dist/apps/web`**.

## Environment variables

### Stack

Source control: **GitHub**. Data & auth: **Supabase**. Hosting: **Vercel** (static app + serverless API under `api/`).

### Vercel (frontend static build + API serverless)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Build / client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Build / client | Supabase anon (public) key |
| `VITE_API_BASE_URL` | Optional | Override API base; default production base is `/api` |
| `SUPABASE_URL` | Serverless (`apps/api`) | Same project URL as above |
| `SUPABASE_ANON_KEY` | Serverless | Validate user JWTs (`Authorization: Bearer`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless only | Trusted server writes — **never** prefix with `VITE_` or expose to the browser |
| `CORS_ORIGIN` | Optional (serverless) | If unset on Vercel, CORS allows **`https://` + `VERCEL_URL`** (set automatically). Add this when you use a **custom domain** or multiple origins (comma-separated). |
| `GEMINI_API_KEY` | Serverless only | AI routes — set on Vercel for `api/` functions |

Vercel sets `VERCEL=1`; the Express app does not call `listen()` and is mounted via `api/index.mjs` + `serverless-http`.

### Local API (non-Vercel)

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` (see `apps/api/.env.example`).

## Database

1. Create a Supabase project.
2. Apply SQL under `supabase/migrations/` (CLI: `supabase link` then `supabase db push`, or paste into the SQL editor in order).

## GitHub

Ensure `.env` files are gitignored (see root `.gitignore`). Rotate any key that was ever committed.
