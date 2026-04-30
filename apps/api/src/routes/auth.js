import 'dotenv/config';
import { Router } from 'express';

/**
 * Legacy PocketBase-shaped auth endpoints are retired.
 * Registration and sign-in use Supabase Auth from the web application.
 */
const router = Router();

router.all('*', (req, res) => {
	res.status(410).json({
		error: 'Deprecated',
		message: 'Use Supabase Auth in the client app. These REST endpoints are no longer supported.',
	});
});

export default router;
