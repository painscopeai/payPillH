import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import logger from '../utils/logger.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';

const router = Router();

const VALID_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SHARE', 'DOWNLOAD'];

const VALID_RESOURCE_TYPES = [
	'user',
	'health_profile',
	'prescription',
	'appointment',
	'recommendation',
	'lab_result',
	'vital_sign',
	'health_goal',
	'document',
	'audit_log',
];

/**
 * POST /audit-logs
 */
router.post('/', async (req, res) => {
	const { user_id, action, resource_type, resource_id, ip_address, user_agent } = req.body;

	if (!user_id) {
		return res.status(400).json({ error: 'Missing required field: user_id' });
	}
	if (!action) {
		return res.status(400).json({ error: 'Missing required field: action' });
	}
	if (!resource_type) {
		return res.status(400).json({ error: 'Missing required field: resource_type' });
	}

	if (!VALID_ACTIONS.includes(action.toUpperCase())) {
		return res.status(400).json({
			error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
		});
	}

	if (!VALID_RESOURCE_TYPES.includes(resource_type.toLowerCase())) {
		return res.status(400).json({
			error: `Invalid resource_type. Must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`,
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: row, error } = await supabaseAdmin
		.from('audit_logs')
		.insert({
			actor_id: user_id,
			action: action.toUpperCase(),
			resource: resource_type.toLowerCase(),
			payload: {
				resource_id: resource_id || '',
				ip_address: ip_address || '',
				user_agent: user_agent || '',
				timestamp: new Date().toISOString(),
			},
		})
		.select('id')
		.single();

	if (error) {
		logger.error(`Audit insert failed: ${error.message}`);
		return res.status(500).json({ error: error.message });
	}

	logger.info(`Audit log created: ${row.id} - ${action} on ${resource_type}`);

	res.status(201).json({
		success: true,
		log_id: row.id,
	});
});

/**
 * GET /audit-logs (admin)
 */
router.get('/', supabaseAuth, async (req, res) => {
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
	if (prof?.role !== 'admin') {
		return res.status(403).json({ error: 'Unauthorized: admin role required' });
	}

	const { user_id, action, start_date, end_date, limit } = req.query;

	let pageLimit = parseInt(limit, 10) || 100;
	if (pageLimit > 1000) pageLimit = 1000;
	if (pageLimit < 1) pageLimit = 1;

	let q = supabaseAdmin.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(pageLimit);

	if (user_id) q = q.eq('actor_id', user_id);
	if (action) q = q.eq('action', action.toUpperCase());
	if (start_date) q = q.gte('created_at', start_date);
	if (end_date) q = q.lte('created_at', end_date);

	const { data: items, error, count } = await q;

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	logger.info(`Fetched ${(items || []).length} audit logs`);

	res.json({
		items: items || [],
		page: 1,
		perPage: pageLimit,
		totalItems: count ?? (items || []).length,
		totalPages: 1,
	});
});

export default router;
