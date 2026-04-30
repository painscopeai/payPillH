/**
 * Same as repo-root `api/health/patient-dashboard-metrics.mjs` when Vercel Root Directory is `apps/web`.
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
	// #region agent log
	const _t0 = Date.now();
	fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
		body: JSON.stringify({
			sessionId: 'a604a1',
			runId: process.env.VERCEL === '1' ? 'prod' : 'pre-fix',
			hypothesisId: 'H1',
			location: 'apps/web/api/health/patient-dashboard-metrics.mjs:entry',
			message: 'lean_handler_start',
			data: { vercel: process.env.VERCEL === '1', method: req.method },
			timestamp: Date.now(),
		}),
	}).catch(() => {});
	// #endregion

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

	const { data: { user }, error: authErr } = await sbAuth.auth.getUser(token);

	// #region agent log
	fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
		body: JSON.stringify({
			sessionId: 'a604a1',
			runId: process.env.VERCEL === '1' ? 'prod' : 'pre-fix',
			hypothesisId: 'H2',
			location: 'apps/web/api/health/patient-dashboard-metrics.mjs:after_getUser',
			message: 'auth_ms',
			data: { ms: Date.now() - _t0, authOk: !!user, authErr: authErr?.message },
			timestamp: Date.now(),
		}),
	}).catch(() => {});
	// #endregion

	if (authErr || !user) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}

	const admin =
		url && serviceKey
			? createClient(url, serviceKey, { auth: { persistSession: false } })
			: createClient(url, anonKey, { auth: { persistSession: false } });

	try {
		const { inferDashboardMetrics } = await import('../../../api/src/health-risk/inferDashboardMetrics.js');
		// #region agent log
		fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
			body: JSON.stringify({
				sessionId: 'a604a1',
				runId: process.env.VERCEL === '1' ? 'prod' : 'pre-fix',
				hypothesisId: 'H4',
				location: 'apps/web/api/health/patient-dashboard-metrics.mjs:before_infer',
				message: 'before_infer_ms',
				data: { ms: Date.now() - _t0 },
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion

		const summary = await inferDashboardMetrics(admin, user.id);

		const totalMs = Date.now() - _t0;
		res.setHeader('X-Dashboard-Metrics-Ms', String(totalMs));

		// #region agent log
		fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
			body: JSON.stringify({
				sessionId: 'a604a1',
				runId: process.env.VERCEL === '1' ? 'prod' : 'pre-fix',
				hypothesisId: 'H3',
				location: 'apps/web/api/health/patient-dashboard-metrics.mjs:success',
				message: 'infer_done_ms',
				data: { totalMs, engineVersion: summary?.engineVersion },
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion

		res.status(200).json(summary);
	} catch (err) {
		// #region agent log
		fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
			body: JSON.stringify({
				sessionId: 'a604a1',
				runId: process.env.VERCEL === '1' ? 'prod' : 'pre-fix',
				hypothesisId: 'H3',
				location: 'apps/web/api/health/patient-dashboard-metrics.mjs:error',
				message: String(err?.message || err),
				data: {},
				timestamp: Date.now(),
			}),
		}).catch(() => {});
		// #endregion
		res.status(500).json({ error: 'metrics_failed' });
	}
}
