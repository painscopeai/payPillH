/**
 * Vercel serverless: Express app (serverless-http).
 * Browser should use VITE_API_BASE_URL=/api in production (see apiServerClient.js).
 */
import serverless from 'serverless-http';
import app from '../apps/api/src/app.js';

export default serverless(app);
