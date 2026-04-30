# Deployment (Vercel + Supabase)

## Vercel project (monorepo root)

Use **one** Vercel project for the static site and the serverless API. Settings in root **`vercel.json`** are the source of truth; match the dashboard to them or turn **off** framework overrides so that file applies.

#### If Vercel shows “Production deployment differs from Project Settings”

That usually means an **old Output Directory override** (for example `dist/apps/web`) is still attached to Production while **`vercel.json`** uses **`apps/web/dist`**. The build can succeed and deploy still fail with **No Output Directory**.

Do one of the following:

1. **Recommended:** In **Settings → Build and Deployment**, turn **Override** **ON** for **Output Directory** and set it to **`apps/web/dist`** (same as root `vercel.json`). Set **Build Command** override to **`npm run build`** and **Install Command** to **`npm install --include=dev`** if you use overrides for everything. Redeploy.

2. Or **clear** Production-specific overrides / redeploy so **`vercel.json`** drives install, build, and output—then ensure **Root Directory** is **`.`** (repo root) and no stale dashboard value still says `dist/apps/web`.

| Setting | Value | Notes |
|--------|--------|--------|
| Root Directory | `.` (repo root) | Do **not** set `apps/api`. Root `npm run build` builds the web app; `apps/api` only runs a no-op `build` and skips Vite. |
| Framework | **Vite** or **Other** | Do **not** use the **Express** preset for this project — it expects `index.js` / `app.js` inside the output directory; Vite emits static `index.html` + assets. |
| Build Command | `npm run build` | Root script runs `npm run build -w web`. |
| Output Directory | `apps/web/dist` | Vite writes to `apps/web/dist` (`--outDir dist` in the web app). |
| Install Command | `npm install --include=dev` | Ensures devDependencies (e.g. Vite) exist during build. |

Serverless Express is deployed from:

- **`api/index.mjs`** at the **repository root** when Vercel **Root Directory** is **`.`** (monorepo root).
- **`apps/web/api/index.mjs`** when Vercel **Root Directory** is **`apps/web`** — the repo-level **`api/`** folder is **not** deployed in that layout.

**Routing:** Vercel’s filesystem `/api` routes are **not** Next.js — patterns like `api/[[...path]].mjs` do **not** reliably catch multi-segment URLs (`/api/health/patient-dashboard-metrics`). **`vercel.json`** must rewrite **`/api`** and **`/api/(.*)`** → **`/api`** so every API call hits **`api/index.mjs`** (same pattern as Vercel’s [Express on Vercel](https://vercel.com/kb/guide/using-express-with-vercel) guide).

Both entries import **`apps/api/src/app.js`**. The app strips the `/api` URL prefix so Express routes stay `/health`, `/auth`, etc.

### Troubleshooting Vercel builds

- **Build log shows `api@0.0.0 build` instead of `web@` / `vite build`** — The project **Root Directory** is still **`apps/api`** (or only that app is being built). Set **Root Directory** to **`.`** (repository root) so root `vercel.json` applies and `npm run build` runs `npm run build -w web`. The `apps/api` `build` script delegates to the root build as a safety net, but **`api/` serverless files only deploy when the Vercel root is the repo** (the `api/` folder must sit at the project root Vercel sees).
- **`No Output Directory named "..."` after build** — Usually the dashboard **Output Directory** override does not match **`apps/web/dist`**, or **Root Directory** is **`apps/web`** without the settings in **`apps/web/vercel.json`** (that file must set `buildCommand` / `outputDirectory` / `installCommand` because Vite does not emit `apps/web/dist` by default for auto-detection). Prefer **Root Directory = `.` (repo root)** and root **`vercel.json`**, or match **`apps/web/vercel.json`** exactly and clear conflicting dashboard overrides.

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

Vercel sets `VERCEL=1`; the Express app does not call `listen()` and is mounted via `api/index.mjs` + `serverless-http` and the rewrites above. The app strips the `/api` path prefix so routes stay `/health`, `/auth`, etc. (local dev still uses `/hcgi/api` → proxy → express without `/api`).

### Local API (non-Vercel)

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` (see `apps/api/.env.example`).

## Database

1. Create a Supabase project.
2. Apply SQL under `supabase/migrations/` (CLI: `supabase link` then `supabase db push`, or paste into the SQL editor in order).

## GitHub

Ensure `.env` files are gitignored (see root `.gitignore`). Rotate any key that was ever committed.
