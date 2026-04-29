import { createClient } from '@supabase/supabase-js';

/**
 * Verifies Supabase JWT from Authorization: Bearer <access_token>.
 * Sets req.supabaseUserId and req.supabaseAccessToken when valid.
 */
export async function supabaseAuthOptional(req, res, next) {
	req.supabaseUserId = null;
	req.supabaseUser = null;
	req.supabaseAccessToken = null;

	const authHeader = req.headers.authorization;
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
	const url = process.env.SUPABASE_URL;
	const anonKey = process.env.SUPABASE_ANON_KEY;

	if (!token || !url || !anonKey) {
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

	req.supabaseUserId = user.id;
	req.supabaseUser = user;
	req.supabaseAccessToken = token;
	next();
}

export async function supabaseAuthRequired(req, res, next) {
	await new Promise((resolve) => supabaseAuthOptional(req, res, resolve));
	if (!req.supabaseUserId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
	next();
}
