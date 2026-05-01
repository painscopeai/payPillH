import { createClient } from '@supabase/supabase-js';
import { withTimeout } from '../utils/withTimeout.js';
import { getUserFromAccessToken } from '../utils/verifySupabaseJwt.js';

const GET_USER_MS = 14_000;

/**
 * Resolves `Authorization: Bearer <supabase_jwt>` and sets `req.user`.
 * Sets `req.pocketbaseUserId` only as a legacy alias (same value as `req.user.id`).
 */
export async function supabaseAuth(req, res, next) {
	try {
		req.user = null;
		req.pocketbaseUserId = null;

		const token = req.headers.authorization?.split(' ')?.[1];
		if (!token) {
			return next();
		}

		const url = process.env.SUPABASE_URL;
		const anonKey = process.env.SUPABASE_ANON_KEY;
		if (!url || !anonKey) {
			return next();
		}

		const local = getUserFromAccessToken(token);
		if (local) {
			req.user = { id: local.id, email: local.email ?? '' };
			req.pocketbaseUserId = local.id;
			return next();
		}

		if (process.env.SUPABASE_JWT_SECRET) {
			// Secret set but token did not verify — treat as anonymous for optional auth
			return next();
		}

		const sb = createClient(url, anonKey, {
			global: { headers: { Authorization: `Bearer ${token}` } },
			auth: { persistSession: false, autoRefreshToken: false },
		});

		let authResult;
		try {
			authResult = await withTimeout(sb.auth.getUser(token), GET_USER_MS, 'getUser');
		} catch {
			return next();
		}

		const { data: { user }, error } = authResult;
		if (error || !user) {
			return next();
		}

		req.user = { id: user.id, email: user.email };
		req.pocketbaseUserId = user.id;
		next();
	} catch (err) {
		next(err);
	}
}
