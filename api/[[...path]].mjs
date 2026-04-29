/**
 * Vercel optional catch-all: handles `/api`, `/api/health/*`, `/api/auth/*`, etc.
 * `api/index.mjs` only matched `/api` exactly, so `/api/health/...` returned platform NOT_FOUND.
 */
import serverless from 'serverless-http';
import app from '../apps/api/src/app.js';

export default serverless(app);
