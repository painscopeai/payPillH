import { Router } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

/**
 * GET /refill-status
 */
router.get('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { user_id } = req.query;

	if (!user_id) {
		return res.status(400).json({
			error: 'Missing required query parameter: user_id',
		});
	}

	const { data: refillRequests, error } = await supabaseAdmin
		.from('refill_requests')
		.select('*')
		.eq('user_id', user_id)
		.order('requested_at', { ascending: false });

	if (error) {
		logger.error('[refills] list', error);
		return res.status(500).json({ error: 'list_failed' });
	}

	const refillsWithDetails = await Promise.all(
		(refillRequests || []).map(async (refill) => {
			try {
				let prescription_details = null;
				let pharmacy_details = null;
				if (refill.prescription_id) {
					const { data: p } = await supabaseAdmin.from('prescriptions').select('*').eq('id', refill.prescription_id).maybeSingle();
					prescription_details = p;
				}
				if (refill.pharmacy_id) {
					const { data: ph } = await supabaseAdmin.from('pharmacies').select('*').eq('id', refill.pharmacy_id).maybeSingle();
					pharmacy_details = ph;
				}
				return {
					...refill,
					prescription_details,
					pharmacy_details,
				};
			} catch (e) {
				logger.warn(`Failed to fetch details for refill ${refill.id}:`, e.message);
				return refill;
			}
		})
	);

	logger.info(`Fetched ${refillsWithDetails.length} refill requests for user ${user_id}`);

	res.json(refillsWithDetails);
});

export default router;
