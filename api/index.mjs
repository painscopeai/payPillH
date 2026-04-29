/**
 * Single serverless entry for all `/api/*` routes (Express lives under `apps/api`).
 *
 * Vercel non-Next projects do not treat `api/[[...path]].mjs` / `[...slug].mjs` like Next.js
 * catch-alls — nested paths such as `/api/health/patient-dashboard-metrics` never hit the
 * function. Rewrites in root `vercel.json` send `/api` and `/api/:path*` to this file.
 */
import serverless from 'serverless-http';
import app from '../apps/api/src/app.js';

export default serverless(app);
