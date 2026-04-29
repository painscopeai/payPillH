/**
 * Vercel serverless entry when Project Root Directory is `apps/web`.
 * Repo-root `api/` is NOT deployed in that layout — only files under `apps/web/` are.
 */
import serverless from 'serverless-http';
import app from '../../api/src/app.js';

export default serverless(app);
