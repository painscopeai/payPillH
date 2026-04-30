# Operations — health risk engine

## API endpoint

- **GET** `/health/patient-dashboard-metrics`
- **Auth:** `Authorization: Bearer <Supabase access_token>` (same JWT the web app uses).
- **Server env:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (JWT validation in middleware path), and **`SUPABASE_SERVICE_ROLE_KEY`** so `supabaseAdmin` can read `profiles`, `patients`, `patient_profiles`, `vitals`, and insert **`health_dashboard_metrics`** snapshots.

## Frontend

- Patient dashboard loads metrics via `apiServerClient` → base URL from `VITE_API_BASE_URL` or `/api` (production) / `/hcgi/api` (dev proxy).

## Running tests locally

From repository root:

```bash
cd apps/api && npm test
```

Tests live under `apps/api/src/health-risk/__tests__/`. They use Node’s built-in test runner (`node --test`). The `npm test` script lists test files explicitly for Windows compatibility.

## Snapshot behaviour

- The **dashboard GET** no longer reads or writes `health_dashboard_metrics` (keeps the serverless function fast). Trend fields in the JSON are informational placeholders.
- A future job or admin path may reintroduce snapshot storage if needed.

## Changing behaviour

1. Bump **`apps/api/src/health-risk/engineVersion.js`**.
2. Update **`RULE_CATALOG.md`** changelog.
3. Adjust code under **`apps/api/src/health-risk/`**.
4. Run **`npm test`** in `apps/api`.
