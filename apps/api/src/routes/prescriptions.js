import { Router } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { sendRefillRequestedToPatient } from '../services/email/resendMail.js';
import { resolveBookingEmails } from '../services/resolveParticipants.js';

const router = Router();

/**
 * POST /prescriptions
 */
router.post('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { user_id, provider_id, medication_name, dosage, frequency, quantity, refills_remaining } = req.body;

	if (!user_id || !provider_id || !medication_name || !dosage || !frequency) {
		return res.status(400).json({
			error: 'Missing required fields: user_id, provider_id, medication_name, dosage, frequency',
		});
	}

	const row = {
		user_id,
		provider_id,
		medication_name,
		dosage,
		frequency,
		quantity: quantity ?? 30,
		refills_remaining: refills_remaining ?? 0,
		status: 'active',
		start_date: new Date().toISOString().slice(0, 10),
	};

	const { data: prescription, error } = await supabaseAdmin.from('prescriptions').insert(row).select('*').single();
	if (error) {
		logger.error('[prescriptions] create', error);
		return res.status(500).json({ error: 'create_failed' });
	}

	logger.info(`Prescription created: ${prescription.id}`);

	res.status(201).json({
		id: prescription.id,
		medication_name: prescription.medication_name,
		dosage: prescription.dosage,
		status: prescription.status,
	});
});

/**
 * GET /prescriptions
 */
router.get('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { user_id } = req.query;

	if (!user_id) {
		return res.status(400).json({ error: 'Missing required query parameter: user_id' });
	}

	const { data, error } = await supabaseAdmin
		.from('prescriptions')
		.select('*')
		.eq('user_id', user_id)
		.limit(50);

	if (error) {
		logger.error('[prescriptions] list', error);
		return res.status(500).json({ error: 'list_failed' });
	}

	logger.info(`Fetched ${data?.length ?? 0} prescriptions for user ${user_id}`);

	res.json(data || []);
});

/**
 * POST /prescriptions/refill
 */
router.post('/refill', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { userId, prescriptionId, quantity, pharmacy, deliveryMethod, specialInstructions } = req.body;

	if (!userId || !prescriptionId) {
		return res.status(400).json({
			error: 'Missing required fields: userId, prescriptionId',
		});
	}

	const { data: prescription, error: prErr } = await supabaseAdmin
		.from('prescriptions')
		.select('*')
		.eq('id', prescriptionId)
		.maybeSingle();

	if (prErr || !prescription) {
		return res.status(404).json({ error: 'Prescription not found' });
	}

	if (prescription.user_id !== userId) {
		return res.status(400).json({ error: 'Prescription does not belong to this user' });
	}

	if (prescription.status !== 'active') {
		return res.status(400).json({ error: 'Prescription is not active' });
	}

	const remaining = Number(prescription.refills_remaining) || 0;
	if (remaining <= 0) {
		return res.status(400).json({ error: 'No refills remaining for this prescription' });
	}

	const refillRequestId = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

	const metadata = {
		refill_request_id: refillRequestId,
		pharmacy: pharmacy || '',
		delivery_method: deliveryMethod || 'standard',
		special_instructions: specialInstructions || '',
	};

	const { data: refillRequest, error: rrErr } = await supabaseAdmin
		.from('refill_requests')
		.insert({
			user_id: userId,
			prescription_id: prescriptionId,
			requested_at: new Date().toISOString(),
			status: 'pending',
			metadata: metadata,
		})
		.select('*')
		.single();

	if (rrErr) {
		logger.error('[prescriptions/refill] insert', rrErr);
		return res.status(500).json({ error: 'refill_create_failed' });
	}

	const newRemaining = remaining - 1;
	const { error: updErr } = await supabaseAdmin
		.from('prescriptions')
		.update({ refills_remaining: newRemaining, updated_at: new Date().toISOString() })
		.eq('id', prescriptionId);

	if (updErr) {
		logger.warn('[prescriptions/refill] update refills', updErr);
	}

	try {
		const { patientEmail } = await resolveBookingEmails(userId, prescription.provider_id);
		if (patientEmail) {
			await sendRefillRequestedToPatient({
				to: patientEmail,
				refillLabel: refillRequestId,
				medicationName: prescription.medication_name,
				dosage: prescription.dosage,
			});
		}
	} catch (e) {
		logger.warn('[prescriptions/refill] email', e.message);
	}

	const estimatedDeliveryDate = new Date();
	estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 5);

	logger.info(`Refill request created: ${refillRequest.id}`);

	res.status(201).json({
		refillRequestId,
		prescriptionId,
		medication: prescription.medication_name,
		dosage: prescription.dosage,
		quantity: quantity || prescription.quantity,
		status: 'pending',
		estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split('T')[0],
		refillsRemaining: newRemaining,
	});
});

/**
 * PUT /prescriptions/:id/refill
 */
router.put('/:id/refill', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { id } = req.params;
	const { pharmacy_id } = req.body;

	if (!pharmacy_id) {
		return res.status(400).json({ error: 'Missing required field: pharmacy_id' });
	}

	const { data: prescription, error: prErr } = await supabaseAdmin.from('prescriptions').select('*').eq('id', id).maybeSingle();
	if (prErr || !prescription) {
		return res.status(404).json({ error: 'Not found' });
	}

	if ((Number(prescription.refills_remaining) || 0) <= 0) {
		return res.status(400).json({ error: 'No refills remaining for this prescription' });
	}

	const { data: refillRequest, error: rrErr } = await supabaseAdmin
		.from('refill_requests')
		.insert({
			user_id: prescription.user_id,
			prescription_id: id,
			pharmacy_id,
			requested_at: new Date().toISOString(),
			status: 'pending',
		})
		.select('*')
		.single();

	if (rrErr) {
		logger.error('[prescriptions/:id/refill]', rrErr);
		return res.status(500).json({ error: 'refill_failed' });
	}

	const newRemaining = (Number(prescription.refills_remaining) || 0) - 1;
	await supabaseAdmin
		.from('prescriptions')
		.update({ refills_remaining: newRemaining, updated_at: new Date().toISOString() })
		.eq('id', id);

	try {
		const { patientEmail } = await resolveBookingEmails(prescription.user_id, prescription.provider_id);
		if (patientEmail) {
			await sendRefillRequestedToPatient({
				to: patientEmail,
				refillLabel: refillRequest.id,
				medicationName: prescription.medication_name,
				dosage: prescription.dosage,
			});
		}
	} catch (e) {
		logger.warn('refill email', e.message);
	}

	const estimatedDeliveryDate = new Date();
	estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 5);

	res.json({
		refill_request_id: refillRequest.id,
		status: 'pending',
		estimated_delivery_date: estimatedDeliveryDate.toISOString().split('T')[0],
	});
});

export default router;
