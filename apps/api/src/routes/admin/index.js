import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import logger from '../../utils/logger.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import adminAnalytics from './analytics.js';

const router = Router();

router.use(requireAdmin);

router.use('/analytics', adminAnalytics);

router.get('/profile/:id', async (req, res) => {
	const id = req.params.id;
	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	const { data, error } = await supabaseAdmin
		.from('profiles')
		.select('id, email, role, first_name, last_name, phone')
		.eq('id', id)
		.maybeSingle();
	if (error) return res.status(500).json({ error: error.message });
	if (!data) return res.status(404).json({ error: 'Profile not found' });
	const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email || 'User';
	res.json({
		id: data.id,
		name,
		email: data.email,
		role: data.role,
		phone: data.phone,
	});
});

router.post('/providers', async (req, res) => {
	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	const { display_name, specialty, user_id } = req.body || {};
	const name = display_name || req.body?.name;
	if (!name || typeof name !== 'string') {
		return res.status(400).json({ error: 'display_name or name required' });
	}
	const { data: row, error } = await supabaseAdmin
		.from('providers')
		.insert({
			display_name: name.trim(),
			specialty: (specialty || req.body?.category || '').trim() || null,
			user_id: user_id || null,
		})
		.select('id, display_name, specialty, created_at')
		.single();
	if (error) return res.status(500).json({ error: error.message });
	res.status(201).json(row);
});

router.get('/forms', (req, res) => res.json({ items: [] }));

router.get('/forms/:formId', (req, res) => {
	res.json({
		id: req.params.formId,
		name: 'Untitled',
		description: '',
		category: 'custom',
		questions: [],
	});
});

router.post('/forms', (req, res) => res.status(501).json({ error: 'Form builder backend is not configured' }));

router.put('/forms/:formId', (req, res) => res.status(501).json({ error: 'Form builder backend is not configured' }));

router.all('/forms/:formId/questions', (req, res) => res.status(501).json({ error: 'Form builder backend is not configured' }));

router.all('/forms/:formId/questions/:questionId', (req, res) => res.status(501).json({ error: 'Form builder backend is not configured' }));

router.get('/forms/:formId/responses', (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	res.json({ items: [], responses: [], page, totalPages: 1 });
});

router.post('/knowledge-base/:docId/reindex', (req, res) => res.status(501).json({ error: 'Not configured' }));

router.get('/knowledge-base', (req, res) => res.json({ items: [] }));

router.get('/knowledge-base/analytics', (req, res) => res.json({}));

router.get('/knowledge-base/search', (req, res) => res.json({ results: [], hits: [] }));

router.post('/knowledge-base/upload', (req, res) => res.status(501).json({ error: 'Knowledge base uploads are not configured' }));

router.get('/knowledge-base/:docId', (req, res) => res.status(404).json({ error: 'Not found' }));

router.delete('/knowledge-base/:docId', (req, res) => res.status(501).json({ error: 'Not configured' }));

router.patch('/knowledge-base/:docId', (req, res) => res.status(501).json({ error: 'Not configured' }));

router.get('/knowledge-base/:docId/chunks', (req, res) => res.json({ chunks: [] }));

router.post('/knowledge-base/:docId/chunks', (req, res) => res.status(501).json({ error: 'Not configured' }));

router.post('/knowledge-base/:docId/versions', (req, res) => res.status(501).json({ error: 'Not configured' }));

router.get('/summary', async (req, res) => {
	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	try {
		const countExact = async (table) => {
			const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
			if (error) throw error;
			return count ?? 0;
		};

		const [{ count: patientRows, error: pe }, { count: individualProfiles, error: ie }] = await Promise.all([
			supabaseAdmin.from('patients').select('*', { count: 'exact', head: true }),
			supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'individual'),
		]);
		if (pe) throw pe;
		if (ie) throw ie;

		const [employers, insurance, providers] = await Promise.all([
			countExact('employers'),
			countExact('insurance_companies'),
			countExact('providers'),
		]);

		/** Registered portal patients: clinical `patients` rows and/or auth profiles with role individual (may exist before a patients row). */
		const patients = Math.max(patientRows ?? 0, individualProfiles ?? 0);

		const { data: auditRows } = await supabaseAdmin
			.from('audit_logs')
			.select('id, actor_id, action, resource, created_at')
			.order('created_at', { ascending: false })
			.limit(10);

		const { data: msgRows } = await supabaseAdmin.from('messages').select('id, body, created_at').order('created_at', { ascending: false }).limit(5);

		const recentActivities = (auditRows || []).map((a) => ({
			id: a.id,
			action: a.action,
			resource_type: a.resource,
			created: a.created_at,
			user_id: a.actor_id,
		}));

		const alerts = (msgRows || []).map((m) => ({
			id: m.id,
			title: (m.body || '').slice(0, 80) || 'Message',
			created: m.created_at,
		}));

		res.json({
			stats: {
				patients,
				employers,
				insurance,
				providers,
				transactions: 0,
				subscriptions: 0,
				mrr: 0,
				arr: 0,
			},
			recentActivities,
			alerts,
		});
	} catch (e) {
		logger.error(`[admin/summary] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/patients', async (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '10'), 10)));
	const search = (req.query.search || '').trim().slice(0, 200);

	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	try {
		let q = supabaseAdmin.from('patients').select('id, user_id, created_at', { count: 'exact' }).order('created_at', { ascending: false });

		if (search) {
			const cleaned = search.replace(/%/g, '').replace(/,/g, ' ').slice(0, 100);
			const term = `%${cleaned}%`;
			const { data: matched } = await supabaseAdmin
				.from('profiles')
				.select('id')
				.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
				.limit(500);
			const ids = (matched || []).map((r) => r.id);
			if (!ids.length) {
				return res.json({ items: [], page, perPage, totalItems: 0, totalPages: 0 });
			}
			q = q.in('user_id', ids);
		}

		const from = (page - 1) * perPage;
		const to = from + perPage - 1;
		const { data: rows, error, count } = await q.range(from, to);
		if (error) throw error;

		const userIds = (rows || []).map((r) => r.user_id).filter(Boolean);
		let profilesByUser = {};
		if (userIds.length) {
			const { data: profs } = await supabaseAdmin
				.from('profiles')
				.select('id, first_name, last_name, email, phone, onboarding_status')
				.in('id', userIds);
			profilesByUser = Object.fromEntries((profs || []).map((p) => [p.id, p]));
		}

		const items = (rows || []).map((row) => {
			const prof = profilesByUser[row.user_id] || {};
			const status =
				(prof.onboarding_status && String(prof.onboarding_status).toLowerCase()) === 'suspended'
					? 'inactive'
					: 'active';
			return {
				id: row.id,
				user_id: row.user_id,
				first_name: prof.first_name || '',
				last_name: prof.last_name || '',
				email: prof.email || '',
				phone: prof.phone || '',
				status,
				created: row.created_at,
			};
		});

		const totalItems = count ?? 0;
		const totalPages = totalItems ? Math.ceil(totalItems / perPage) : 0;

		res.json({ items, page, perPage, totalItems, totalPages });
	} catch (e) {
		logger.error(`[admin/patients] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

async function countsByEmployerIds(employerIds) {
	if (!employerIds.length || !supabaseAdmin) return {};
	const { data: ee } = await supabaseAdmin.from('employer_employees').select('employer_id').in('employer_id', employerIds);
	const counts = {};
	for (const row of ee || []) {
		counts[row.employer_id] = (counts[row.employer_id] || 0) + 1;
	}
	return counts;
}

router.get('/employers', async (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '10'), 10)));
	const search = (req.query.search || '').trim().slice(0, 200);
	const statusFilter = (req.query.status || 'all').toLowerCase();

	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	try {
		let q = supabaseAdmin.from('employers').select('*', { count: 'exact' }).order('created_at', { ascending: false });

		if (search) {
			const safe = search.replace(/,/g, ' ');
			q = q.ilike('name', `%${safe}%`);
		}
		if (statusFilter === 'inactive') {
			q = q.filter('payload->>status', 'eq', 'inactive');
		} else if (statusFilter === 'active') {
			q = q.or('payload->>status.is.null,payload->>status.eq.active');
		}

		const from = (page - 1) * perPage;
		const to = from + perPage - 1;
		const { data: filtered, error, count } = await q.range(from, to);
		if (error) throw error;

		const rows = filtered || [];
		const cnt = await countsByEmployerIds(rows.map((e) => e.id));

		const items = rows.map((e) => ({
			id: e.id,
			name: e.name || e.payload?.company_name || 'Employer',
			industry: e.payload?.industry ?? '—',
			employee_count: cnt[e.id] || 0,
			status: e.payload?.status ?? 'active',
			created: e.created_at,
			payload: e.payload,
			owner_user_id: e.owner_user_id,
		}));

		res.json({
			items,
			page,
			perPage,
			totalItems: count ?? 0,
			totalPages: count ? Math.ceil(count / perPage) : 0,
		});
	} catch (e) {
		logger.error(`[admin/employers] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.patch('/employers/:id', async (req, res) => {
	const id = req.params.id;
	const status = req.body?.status;
	if (!id || !['active', 'inactive'].includes(status)) {
		return res.status(400).json({ error: 'Body must include status: active | inactive' });
	}
	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });

	const { data: row, error: fe } = await supabaseAdmin.from('employers').select('payload').eq('id', id).maybeSingle();
	if (fe || !row) return res.status(404).json({ error: 'Employer not found' });

	const nextPayload = { ...(row.payload || {}), status };

	const { error: ue } = await supabaseAdmin
		.from('employers')
		.update({ payload: nextPayload, updated_at: new Date().toISOString() })
		.eq('id', id);
	if (ue) return res.status(500).json({ error: ue.message });

	res.json({ success: true, id, status });
});

router.get('/insurance-companies', async (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '10'), 10)));
	const search = (req.query.search || '').trim().slice(0, 200);

	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	try {
		let q = supabaseAdmin.from('insurance_companies').select('*', { count: 'exact' }).order('created_at', { ascending: false });
		if (search) q = q.ilike('name', `%${search}%`);

		const from = (page - 1) * perPage;
		const to = from + perPage - 1;
		const { data: rows, error, count } = await q.range(from, to);
		if (error) throw error;

		const items = (rows || []).map((r) => ({
			id: r.id,
			name: r.name,
			license_number: r.license_number,
			status: r.status || 'active',
			created: r.created_at,
		}));

		res.json({
			items,
			page,
			perPage,
			totalItems: count ?? 0,
			totalPages: count ? Math.ceil(count / perPage) : 0,
		});
	} catch (e) {
		logger.error(`[admin/insurance-companies] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/providers', async (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '20'), 10)));
	const search = (req.query.search || '').trim().slice(0, 200);

	if (!supabaseAdmin) return res.status(503).json({ error: 'Database unavailable' });
	try {
		let q = supabaseAdmin.from('providers').select('*', { count: 'exact' }).order('created_at', { ascending: false });
		if (search) {
			const cleaned = search.replace(/%/g, '').replace(/,/g, ' ').slice(0, 100);
			const patt = `%${cleaned}%`;
			q = q.or(`display_name.ilike.${patt},specialty.ilike.${patt}`);
		}

		const from = (page - 1) * perPage;
		const to = from + perPage - 1;
		const { data: rows, error, count } = await q.range(from, to);
		if (error) throw error;

		const userIds = (rows || []).map((r) => r.user_id).filter(Boolean);
		let emailByUser = {};
		if (userIds.length) {
			const { data: profs } = await supabaseAdmin.from('profiles').select('id, email').in('id', userIds);
			emailByUser = Object.fromEntries((profs || []).map((p) => [p.id, p.email]));
		}

		const items = (rows || []).map((r) => ({
			id: r.id,
			name: r.display_name || 'Provider',
			category: r.specialty || '—',
			email: emailByUser[r.user_id] || '—',
			status: 'active',
			verification_status: 'verified',
			created: r.created_at,
		}));

		res.json({
			items,
			page,
			perPage,
			totalItems: count ?? 0,
			totalPages: count ? Math.ceil(count / perPage) : 0,
		});
	} catch (e) {
		logger.error(`[admin/providers] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

const emptyList = (page, perPage) => ({
	items: [],
	page,
	perPage,
	totalItems: 0,
	totalPages: 1,
});

router.get('/transactions', (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '15'), 10)));
	res.json(emptyList(page, perPage));
});

router.get('/subscription-plans', (req, res) => res.json(emptyList(1, 50)));
router.get('/subscriptions', (req, res) => {
	const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
	const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || '15'), 10)));
	res.json(emptyList(page, perPage));
});
router.get('/subscription-logs', (req, res) => res.json(emptyList(1, 20)));
router.get('/ai-logs', (req, res) => res.json(emptyList(1, 20)));

export default router;
