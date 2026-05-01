import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { withTimeout } from '../utils/withTimeout.js';
import { getUserFromAccessToken } from '../utils/verifySupabaseJwt.js';

const GET_USER_MS = 14_000;
const PROFILE_QUERY_MS = 14_000;

/**
 * Requires `Authorization: Bearer <supabase_jwt>` and `profiles.role === 'admin'`.
 *
 * When `SUPABASE_JWT_SECRET` is set, the access token is verified locally (no Auth API round-trip),
 * which avoids 60s Vercel timeouts when Supabase Auth is slow. The profile row is still loaded
 * once to confirm `role === 'admin'`.
 */
export async function requireAdmin(req, res, next) {
	try {
		const token = req.headers.authorization?.split(' ')?.[1];
		if (!token) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}

		const url = process.env.SUPABASE_URL;
		const anonKey = process.env.SUPABASE_ANON_KEY;
		if (!url || !anonKey) {
			res.status(503).json({ error: 'Auth not configured' });
			return;
		}

		let user = null;

		const local = getUserFromAccessToken(token);
		if (process.env.SUPABASE_JWT_SECRET) {
			if (!local) {
				res.status(401).json({ error: 'Unauthorized' });
				return;
			}
			user = { id: local.id, email: local.email ?? '' };
		} else {
			const sb = createClient(url, anonKey, {
				global: { headers: { Authorization: `Bearer ${token}` } },
				auth: { persistSession: false, autoRefreshToken: false },
			});

			let authResult;
			try {
				authResult = await withTimeout(sb.auth.getUser(token), GET_USER_MS, 'getUser');
			} catch (e) {
				if (e?.code === 'ETIMEOUT') {
					res.status(503).json({ error: 'Auth service timeout — set SUPABASE_JWT_SECRET on the API for faster verification.' });
					return;
				}
				throw e;
			}

			const { data: { user: u }, error: authErr } = authResult;
			if (authErr || !u) {
				res.status(401).json({ error: 'Unauthorized' });
				return;
			}
			user = u;
		}

		req.user = { id: user.id, email: user.email };
		req.pocketbaseUserId = user.id;

		if (!supabaseAdmin) {
			res.status(503).json({ error: 'Database unavailable' });
			return;
		}

		let prof;
		let profErr;
		try {
			const q = supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
			const result = await withTimeout(q, PROFILE_QUERY_MS, 'profiles');
			prof = result.data;
			profErr = result.error;
		} catch (e) {
			if (e?.code === 'ETIMEOUT') {
				res.status(503).json({ error: 'Database timeout loading profile' });
				return;
			}
			throw e;
		}

		if (profErr) {
			res.status(500).json({ error: profErr.message });
			return;
		}
		if (prof?.role !== 'admin') {
			res.status(403).json({ error: 'Unauthorized: admin role required' });
			return;
		}

		next();
	} catch (e) {
		next(e);
	}
}
