import { createClient } from '@supabase/supabase-js';

/**
 * Resolves `Authorization: Bearer <supabase_jwt>` and sets `req.user` / `req.pocketbaseUserId`
 * (legacy name) to the auth user id. Safe no-op if token missing or invalid.
 */
export async function pocketbaseAuth(req, res, next) {
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

	const sb = createClient(url, anonKey, {
		global: { headers: { Authorization: `Bearer ${token}` } },
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data: { user }, error } = await sb.auth.getUser(token);
	if (error || !user) {
		return next();
	}

	req.user = { id: user.id, email: user.email };
	req.pocketbaseUserId = user.id;
	next();
}
