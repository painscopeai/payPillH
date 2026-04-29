# Deployment (Vercel + Supabase)

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
