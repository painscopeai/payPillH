import { Router } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

/**
 * POST /telemedicine/start
 */
router.post('/start', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { appointment_id } = req.body;

	if (!appointment_id) {
		return res.status(400).json({
			error: 'Missing required field: appointment_id',
		});
	}

	const { data: appointment, error: aErr } = await supabaseAdmin
		.from('appointments')
		.select('*')
		.eq('id', appointment_id)
		.maybeSingle();

	if (aErr || !appointment) {
		return res.status(404).json({ error: 'Appointment not found' });
	}

	if (String(appointment.type).toLowerCase() !== 'telemedicine') {
		return res.status(400).json({
			error: 'Appointment is not a telemedicine appointment',
		});
	}

	const startedAt = new Date().toISOString();
	const { data: session, error: sErr } = await supabaseAdmin
		.from('telemedicine_sessions')
		.insert({
			appointment_id,
			payload: {
				status: 'active',
				user_id: appointment.user_id,
				provider_id: appointment.provider_id,
			},
			started_at: startedAt,
		})
		.select('*')
		.single();

	if (sErr) {
		logger.error('[telemedicine] insert', sErr);
		return res.status(500).json({ error: 'session_create_failed' });
	}

	const callToken = `token_${session.id}_${Date.now()}`;

	logger.info(`Telemedicine session started: ${session.id}`);

	res.json({
		session_id: session.id,
		call_token: callToken,
		appointment_details: {
			id: appointment.id,
			appointment_date: appointment.appointment_date,
			appointment_time: appointment.appointment_time,
			provider_id: appointment.provider_id,
		},
	});
});

export default router;
