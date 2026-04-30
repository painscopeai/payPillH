import { supabaseAuth } from './supabase-auth.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Requires `Authorization: Bearer <supabase_jwt>` and `profiles.role === 'admin'`.
 */
export function requireAdmin(req, res, next) {
	supabaseAuth(req, res, async () => {
		if (!req.user?.id) {
			res.status(401).json({ error: 'Unauthorized' });
			return;
		}
		if (!supabaseAdmin) {
			res.status(503).json({ error: 'Database unavailable' });
			return;
		}
		const { data: prof, error } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).maybeSingle();
		if (error) {
			res.status(500).json({ error: error.message });
			return;
		}
		if (prof?.role !== 'admin') {
			res.status(403).json({ error: 'Unauthorized: admin role required' });
			return;
		}
		next();
	});
}
