/**
 * Serverless entry when Vercel Root Directory is `apps/web`.
 * Rewrites in `apps/web/vercel.json` route `/api` and `/api/*` here (see root `api/index.mjs`).
 */
import serverless from 'serverless-http';
import app from '../../api/src/app.js';

export default serverless(app);
