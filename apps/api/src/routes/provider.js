import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import logger from '../utils/logger.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';

const router = Router();

router.use(supabaseAuth);

/**
 * GET /provider/patients
 */
router.get('/patients', async (req, res) => {
	const authId = req.user?.id;
	if (!authId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: prov } = await supabaseAdmin.from('providers').select('id').eq('user_id', authId).maybeSingle();
	if (!prov) {
		return res.json([]);
	}

	const { data: relationships } = await supabaseAdmin
		.from('patient_provider_relationships')
		.select('patient_id, created_at')
		.eq('provider_id', prov.id);

	const patientIds = (relationships || []).map((r) => r.patient_id);
	if (patientIds.length === 0) {
		return res.json([]);
	}

	const { data: patients } = await supabaseAdmin.from('patients').select('id, user_id').in('id', patientIds);

	const userIds = (patients || []).map((p) => p.user_id).filter(Boolean);
	const { data: profiles } = await supabaseAdmin.from('profiles').select('*').in('id', userIds);

	const { data: healthProfiles } = await supabaseAdmin.from('health_profile').select('*').in('user_id', userIds);

	const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
	const hpByUserId = Object.fromEntries((healthProfiles || []).map((h) => [h.user_id, h]));

	const patientsWithDetails = (relationships || []).map((rel) => {
		const patientRow = (patients || []).find((p) => p.id === rel.patient_id);
		const uid = patientRow?.user_id;
		return {
			...rel,
			patient_details: uid ? profileByUserId[uid] ?? { id: uid } : {},
			health_summary: uid ? hpByUserId[uid] ?? {} : {},
		};
	});

	logger.info(`Fetched ${patientsWithDetails.length} patients for provider ${authId}`);

	res.json(patientsWithDetails);
});

/**
 * PUT /provider/patients/:id — id is public.patients.id
 */
router.put('/patients/:id', async (req, res) => {
	const { id } = req.params;
	const { treatment_plan, notes } = req.body;
	const authId = req.user?.id;
	if (!authId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: prov } = await supabaseAdmin.from('providers').select('id').eq('user_id', authId).maybeSingle();
	if (!prov) {
		return res.status(403).json({ error: 'Not a registered provider' });
	}

	const { data: patient } = await supabaseAdmin.from('patients').select('id, user_id').eq('id', id).maybeSingle();
	if (!patient) {
		return res.status(404).json({ error: 'Patient not found' });
	}

	const { data: rel } = await supabaseAdmin
		.from('patient_provider_relationships')
		.select('id')
		.eq('provider_id', prov.id)
		.eq('patient_id', patient.id)
		.maybeSingle();

	if (!rel) {
		return res.status(403).json({
			error: 'You do not have access to this patient',
		});
	}

	let updatedProfile = null;
	if (treatment_plan) {
		const { data: hp } = await supabaseAdmin.from('health_profile').select('id, data').eq('user_id', patient.user_id).maybeSingle();
		const nextData = { ...(hp?.data && typeof hp.data === 'object' ? hp.data : {}), treatment_plan };
		const { data: upserted } = await supabaseAdmin
			.from('health_profile')
			.upsert(
				{
					user_id: patient.user_id,
					data: nextData,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'user_id' }
			)
			.select()
			.single();
		updatedProfile = upserted;
	}

	if (notes) {
		await supabaseAdmin.from('clinical_notes').insert({
			patient_id: patient.id,
			provider_id: prov.id,
			note: notes,
		});
	}

	logger.info(`Updated patient ${id} by provider ${authId}`);

	res.json(updatedProfile ?? { ok: true });
});

/**
 * POST /provider/notes — user_id is auth user id of the patient
 */
router.post('/notes', async (req, res) => {
	const { user_id, note_content } = req.body;
	const authId = req.user?.id;
	if (!authId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!user_id || !note_content) {
		return res.status(400).json({
			error: 'Missing required fields: user_id, note_content',
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: prov } = await supabaseAdmin.from('providers').select('id').eq('user_id', authId).maybeSingle();
	if (!prov) {
		return res.status(403).json({ error: 'Not a registered provider' });
	}

	const { data: patient } = await supabaseAdmin.from('patients').select('id').eq('user_id', user_id).maybeSingle();
	if (!patient) {
		return res.status(404).json({ error: 'Patient not found' });
	}

	const { data: rel } = await supabaseAdmin
		.from('patient_provider_relationships')
		.select('id')
		.eq('provider_id', prov.id)
		.eq('patient_id', patient.id)
		.maybeSingle();

	if (!rel) {
		return res.status(403).json({
			error: 'You do not have access to this patient',
		});
	}

	const { data: noteRow, error } = await supabaseAdmin
		.from('clinical_notes')
		.insert({
			patient_id: patient.id,
			provider_id: prov.id,
			note: note_content,
		})
		.select('id, created_at')
		.single();

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	logger.info(`Clinical note created: ${noteRow.id}`);

	res.json({
		id: noteRow.id,
		date_created: noteRow.created_at,
	});
});

export default router;
