/**
 * Dedicated serverless entry for GET /api/health/patient-dashboard-metrics.
 * Stays off the full Express bundle (api/index.mjs) to avoid cold-start timeouts.
 */
import { createClient } from '@supabase/supabase-js';
import {
	inferDashboardMetrics,
	buildDegradedDashboardSummary,
} from '../../apps/api/src/health-risk/inferDashboardMetrics.js';

function withTimeout(promise, ms, code) {
	return Promise.race([
		promise,
		new Promise((_, rej) => setTimeout(() => rej(new Error(code)), ms)),
	]);
}

export default async function handler(req, res) {
	if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const url = process.env.SUPABASE_URL;
	const anonKey = process.env.SUPABASE_ANON_KEY;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !anonKey) {
		res.status(503).json({ error: 'Server misconfigured' });
		return;
	}

	const token = req.headers.authorization?.split?.(' ')?.[1];
	if (!token) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}

	const sbAuth = createClient(url, anonKey, {
		global: { headers: { Authorization: `Bearer ${token}` } },
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const _t0 = Date.now();
	res.setHeader('X-PayPill-Metrics-Handler', 'dedicated');

	let user;
	let authErr;
	try {
		const authRes = await withTimeout(sbAuth.auth.getUser(token), 12000, 'auth_timeout');
		user = authRes.data?.user;
		authErr = authRes.error;
	} catch (e) {
		res.setHeader('X-Dashboard-Metrics-Ms', String(Date.now() - _t0));
		res.status(503).json({ error: 'auth_upstream_timeout' });
		return;
	}

	if (authErr || !user) {
		res.setHeader('X-Dashboard-Metrics-Ms', String(Date.now() - _t0));
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}

	const admin =
		url && serviceKey
			? createClient(url, serviceKey, { auth: { persistSession: false } })
			: createClient(url, anonKey, { auth: { persistSession: false } });

	try {
		const summary = await withTimeout(inferDashboardMetrics(admin, user.id), 28000, 'infer_timeout');
		res.setHeader('X-Dashboard-Metrics-Ms', String(Date.now() - _t0));
		res.status(200).json(summary);
	} catch (err) {
		const code = err?.message || String(err);
		if (code === 'infer_timeout' || code === 'profiles_query_timeout') {
			res.setHeader('X-Dashboard-Metrics-Ms', String(Date.now() - _t0));
			res.setHeader('X-PayPill-Metrics-Degraded', '1');
			res.status(200).json(buildDegradedDashboardSummary(code));
			return;
		}
		res.setHeader('X-Dashboard-Metrics-Ms', String(Date.now() - _t0));
		res.status(500).json({ error: 'metrics_failed' });
	}
}
