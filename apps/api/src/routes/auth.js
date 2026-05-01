import { loadLocalEnv } from '../lib/loadEnv.js';
import { Router } from 'express';

loadLocalEnv();

/**
 * Legacy PocketBase-shaped auth endpoints are retired.
 * Registration and sign-in use Supabase Auth from the web application.
 */
const router = Router();

// Express 5 / path-to-regexp v8 rejects bare '*'; use a catch-all middleware instead.
router.use((req, res) => {
	res.status(410).json({
		error: 'Deprecated',
		message: 'Use Supabase Auth in the client app. These REST endpoints are no longer supported.',
	});
});

export default router;
