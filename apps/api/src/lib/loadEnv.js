import dotenv from 'dotenv';

/**
 * Load `.env` only when not running on Vercel. On Vercel, `process.env` is injected by the
 * platform — reading a local `.env` file is unnecessary and can confuse debugging.
 */
export function loadLocalEnv() {
	if (process.env.VERCEL === '1') return;
	dotenv.config();
}
