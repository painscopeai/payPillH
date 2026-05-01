import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Requires `Authorization: Bearer <supabase_jwt>` and `profiles.role === 'admin'`.
 * Async with full try/catch so Vercel serverless never dies on unhandled rejections.
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

		const sb = createClient(url, anonKey, {
			global: { headers: { Authorization: `Bearer ${token}` } },
			auth: { persistSession: false, autoRefreshToken: false },
		});

		const { data: { user }, error: authErr } = await sb.auth.getUser(token);
		if (authErr || !user) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}

		req.user = { id: user.id, email: user.email };
		req.pocketbaseUserId = user.id;

		if (!supabaseAdmin) {
			res.status(503).json({ error: 'Database unavailable' });
			return;
		}

		const { data: prof, error: profErr } = await supabaseAdmin
			.from('profiles')
			.select('role')
			.eq('id', req.user.id)
			.maybeSingle();

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
