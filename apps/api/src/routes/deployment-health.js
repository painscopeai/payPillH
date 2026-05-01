import { hasServiceRoleKey } from '../lib/supabaseAdmin.js';

/**
 * GET /health/deployment — no secrets; confirms Vercel env wiring for Supabase admin API.
 * Call from browser: https://<host>/api/health/deployment
 */
export default function deploymentHealth(req, res) {
	const url = Boolean(process.env.SUPABASE_URL?.trim());
	res.json({
		ok: true,
		runtime: process.env.VERCEL === '1' ? 'vercel' : 'other',
		supabase: {
			urlConfigured: url,
			anonKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY?.trim()),
			serviceRoleConfigured: hasServiceRoleKey,
			jwtSecretConfigured: Boolean(process.env.SUPABASE_JWT_SECRET?.trim()),
		},
		adminApiReady: hasServiceRoleKey && url,
		hint: hasServiceRoleKey
			? null
			: 'Set SUPABASE_SERVICE_ROLE_KEY on this Vercel project (same project as SUPABASE_URL). Redeploy after saving.',
	});
}
