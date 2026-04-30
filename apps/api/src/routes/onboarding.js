import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import logger from '../utils/logger.js';
import { validateStep, validateAllSteps } from '../utils/validation.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';

const router = Router();

router.use(supabaseAuth);

/**
 * POST /onboarding/processing-snapshot
 */
router.post('/processing-snapshot', async (req, res) => {
	if (!req.user?.id) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
	const { payload, stage = 'complete' } = req.body || {};
	if (!payload || typeof payload !== 'object') {
		return res.status(400).json({ error: 'payload required' });
	}
	if (!supabaseAdmin) {
		logger.error('processing-snapshot: supabaseAdmin not configured');
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { data: pat, error: patErr } = await supabaseAdmin
		.from('patients')
		.select('id')
		.eq('user_id', req.user.id)
		.maybeSingle();
	if (patErr) {
		logger.warn(`processing-snapshot patient lookup: ${patErr.message}`);
	}

	const stageStr = String(stage).slice(0, 64) || 'complete';
	const { error: insErr } = await supabaseAdmin.from('onboarding_processing_snapshots').insert({
		user_id: req.user.id,
		patient_id: pat?.id ?? null,
		payload,
		stage: stageStr,
	});
	if (insErr) {
		logger.error('processing-snapshot insert failed', insErr);
		return res.status(500).json({ error: 'persist_failed' });
	}
	return res.status(204).send();
});

/**
 * POST /onboarding/save-step — persists into profiles.onboarding_draft (step1…stepN)
 */
router.post('/save-step', async (req, res) => {
	const { step, data } = req.body;

	if (!req.user?.id) {
		return res.status(401).json({ error: 'Authentication failed: user not found in request' });
	}
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const patientId = req.user.id;

	if (step === undefined || step === null) {
		return res.status(400).json({ error: 'Missing required field: step' });
	}
	if (!data || typeof data !== 'object') {
		return res.status(400).json({ error: 'Missing required field: data (must be an object)' });
	}

	const stepNum = parseInt(step, 10);
	if (Number.isNaN(stepNum) || stepNum < 1 || stepNum > 13) {
		return res.status(400).json({ error: 'Invalid step number. Must be between 1 and 13.' });
	}

	const validation = validateStep(stepNum, data);
	if (!validation.valid) {
		return res.status(400).json({ error: 'Validation failed', fields: validation.errors });
	}

	const { data: prof, error: readErr } = await supabaseAdmin
		.from('profiles')
		.select('onboarding_draft')
		.eq('id', patientId)
		.maybeSingle();
	if (readErr) {
		logger.error('save-step read profile', readErr);
		return res.status(500).json({ error: 'read_failed' });
	}

	const draft =
		prof?.onboarding_draft && typeof prof.onboarding_draft === 'object' ? prof.onboarding_draft : {};
	const key = `step${stepNum}`;
	const merged = {
		...draft,
		[key]: { ...(draft[key] || {}), ...data },
	};

	const { error: upErr } = await supabaseAdmin
		.from('profiles')
		.update({
			onboarding_draft: merged,
			onboarding_current_step: stepNum,
			updated_at: new Date().toISOString(),
		})
		.eq('id', patientId);

	if (upErr) {
		logger.error('save-step update', upErr);
		return res.status(500).json({ error: 'save_failed' });
	}

	logger.info(`Onboarding step ${stepNum} saved for ${patientId}`);

	res.json({
		success: true,
		step: stepNum,
		message: `Step ${stepNum} saved successfully`,
	});
});

/**
 * GET /onboarding/progress
 */
router.get('/progress', async (req, res) => {
	if (!req.user?.id) {
		return res.status(401).json({ error: 'Authentication failed: user not found in request' });
	}
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const patientId = req.user.id;

	const { data: prof, error } = await supabaseAdmin
		.from('profiles')
		.select('onboarding_draft, onboarding_current_step, updated_at')
		.eq('id', patientId)
		.maybeSingle();

	if (error) {
		logger.error('progress read', error);
		return res.status(500).json({ error: 'read_failed' });
	}

	const draft = prof?.onboarding_draft && typeof prof.onboarding_draft === 'object' ? prof.onboarding_draft : {};
	const completedSteps = [];
	for (let i = 1; i <= 13; i++) {
		const k = `step${i}`;
		const block = draft[k];
		if (block && typeof block === 'object' && Object.keys(block).length > 0) {
			completedSteps.push(i);
		}
	}

	let currentStep = prof?.onboarding_current_step ?? 1;
	if (typeof currentStep !== 'number' || currentStep < 1 || currentStep > 13) {
		currentStep = 1;
		for (let i = 1; i <= 13; i++) {
			if (!completedSteps.includes(i)) {
				currentStep = i;
				break;
			}
		}
	}

	const formData = {};
	for (const s of completedSteps) {
		formData[`step_${s}`] = draft[`step${s}`];
	}

	res.json({
		currentStep,
		completedSteps: completedSteps.sort((a, b) => a - b),
		formData,
		lastSaved: prof?.updated_at || null,
	});
});

/**
 * POST /onboarding/complete
 */
router.post('/complete', async (req, res) => {
	if (!req.user?.id) {
		return res.status(401).json({ error: 'Authentication failed: user not found in request' });
	}
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { allData } = req.body;
	const patientId = req.user.id;

	if (!allData || typeof allData !== 'object') {
		return res.status(400).json({ error: 'Missing required field: allData (must be an object)' });
	}

	const validation = validateAllSteps(allData);
	if (!validation.valid) {
		return res.status(400).json({ error: 'Validation failed for one or more steps', errors: validation.errors });
	}

	const completedAt = new Date().toISOString();

	const { error: upErr } = await supabaseAdmin
		.from('profiles')
		.update({
			onboarding_completed: true,
			onboarding_completed_at: completedAt,
			profile_completion_percent: 100,
			updated_at: completedAt,
		})
		.eq('id', patientId);

	if (upErr) {
		logger.error('complete profile update', upErr);
		return res.status(500).json({ error: 'complete_failed' });
	}

	logger.info(`Onboarding completed for patient ${patientId}`);
	logger.info('[onboarding/complete] AI recommendation hook skipped (use client or background job)');

	res.json({
		success: true,
		message: 'Onboarding completed successfully',
		recommendations_generated: 0,
		completed_at: completedAt,
	});
});

export default router;
