import { loadLocalEnv } from '../lib/loadEnv.js';
import { Router } from 'express';

loadLocalEnv();
import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { ensurePatientForUser } from '../lib/ensurePatient.js';
import logger from '../utils/logger.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { preparePatientDataForAnalysis, formatHealthDataForPrompt } from '../utils/healthDataAnalyzer.js';

const router = Router();

function requireUser(req, res) {
	if (!req.user?.id) {
		res.status(401).json({ error: 'Unauthorized' });
		return null;
	}
	return req.user.id;
}

/**
 * POST /ai-recommendations
 * Generate personalized health recommendations using Gemini API
 */
router.post('/', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { patient_id, focus_area, include_history } = req.body;

	if (!patient_id) {
		return res.status(400).json({
			error: 'Missing required field: patient_id',
		});
	}

	if (patient_id !== uid) {
		return res.status(403).json({ error: 'Unauthorized: patient_id does not match authenticated user' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const geminiApiKey = process.env.GEMINI_API_KEY;
	if (!geminiApiKey) {
		return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
	}

	logger.info(`Generating AI recommendations for patient ${patient_id}`);

	const healthData = await preparePatientDataForAnalysis(patient_id);
	const healthDataText = formatHealthDataForPrompt(healthData);

	const systemPrompt = `You are a HIPAA-compliant healthcare AI assistant specializing in personalized health recommendations. 
Your role is to analyze patient health data and provide evidence-based, actionable recommendations.

IMPORTANT GUIDELINES:
1. All recommendations must be based on current medical evidence and guidelines
2. Prioritize patient safety and privacy
3. Recommend consulting healthcare providers for major decisions
4. Provide clear reasoning for each recommendation
5. Include confidence scores based on evidence strength
6. Format recommendations as structured JSON

Generate 5-10 personalized health recommendations based on the patient's complete health profile.`;

	const userPrompt = `${systemPrompt}

Patient Health Data:
${healthDataText}

Focus Area: ${focus_area || 'comprehensive'}
Include History: ${include_history || false}

Generate personalized health recommendations. Return ONLY a valid JSON array with this structure:
[
  {
    "title": "Recommendation title",
    "description": "Detailed description of the recommendation",
    "priority": "high|medium|low",
    "category": "medication|lifestyle|preventive|specialist|lab|vaccination|screening",
    "related_conditions": ["condition1", "condition2"],
    "suggested_actions": ["action1", "action2"],
    "timeline": "immediate|1-2 weeks|1-3 months|ongoing",
    "sources": ["source1", "source2"],
    "confidence_score": 0.85,
    "risk_if_ignored": "Description of potential risks"
  }
]

Ensure all recommendations are medically accurate and patient-specific.`;

	let geminiResponse;
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		geminiResponse = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
			{
				contents: [
					{
						parts: [{ text: userPrompt }],
					},
				],
			},
			{
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
			}
		);

		clearTimeout(timeoutId);
	} catch (error) {
		if (error.code === 'ECONNABORTED') {
			return res.status(504).json({ error: 'Gemini API request timeout (30 seconds)' });
		}
		return res.status(502).json({ error: `Gemini API error: ${error.message}` });
	}

	if (!geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
		return res.status(502).json({ error: 'Invalid response from Gemini API: missing content' });
	}

	const responseText = geminiResponse.data.candidates[0].content.parts[0].text;

	let recommendations = [];
	try {
		const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
		const jsonString = jsonMatch ? jsonMatch[0] : responseText;
		recommendations = JSON.parse(jsonString);
	} catch (parseError) {
		logger.warn(`Failed to parse Gemini response as JSON: ${parseError.message}`);
		return res.status(502).json({ error: 'Failed to parse recommendations from Gemini API response' });
	}

	const formattedRecommendations = recommendations
		.filter((rec) => rec && rec.title && rec.description)
		.map((rec) => ({
			title: rec.title || '',
			description: rec.description || '',
			priority: rec.priority || 'medium',
			category: rec.category || 'general',
			related_conditions: Array.isArray(rec.related_conditions) ? rec.related_conditions : [],
			suggested_actions: Array.isArray(rec.suggested_actions) ? rec.suggested_actions : [],
			timeline: rec.timeline || 'ongoing',
			sources: Array.isArray(rec.sources) ? rec.sources : [],
			confidence_score: typeof rec.confidence_score === 'number' ? rec.confidence_score : 0.5,
			risk_if_ignored: rec.risk_if_ignored || '',
			status: 'Pending',
		}));

	const pid = await ensurePatientForUser(patient_id);
	const savedRecommendations = [];

	for (const rec of formattedRecommendations) {
		const metadata = {
			priority: rec.priority,
			category: rec.category,
			related_conditions: rec.related_conditions,
			suggested_actions: rec.suggested_actions,
			timeline: rec.timeline,
			sources: rec.sources,
			confidence_score: rec.confidence_score,
			risk_if_ignored: rec.risk_if_ignored,
		};

		const { data: inserted, error } = await supabaseAdmin
			.from('patient_recommendations')
			.insert({
				patient_id: pid,
				title: rec.title,
				body: rec.description,
				status: rec.status,
				source: 'gemini',
				metadata,
			})
			.select()
			.single();

		if (error) {
			logger.warn(`Failed to save recommendation: ${error.message}`);
		} else {
			savedRecommendations.push(inserted);
		}
	}

	try {
		await supabaseAdmin.from('recommendation_requests').insert({
			patient_id: pid,
			payload: {
				focus_area: focus_area || 'comprehensive',
				include_history: include_history || false,
				count: savedRecommendations.length,
				status: 'completed',
			},
		});
	} catch (error) {
		logger.warn(`Failed to create recommendation request record: ${error.message}`);
	}

	logger.info(`Generated and saved ${savedRecommendations.length} recommendations for patient ${patient_id}`);

	res.json({
		success: true,
		recommendations: savedRecommendations,
		count: savedRecommendations.length,
	});
});

/**
 * GET /ai-recommendations
 */
router.get('/', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { status, category } = req.query;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	let q = supabaseAdmin.from('patient_recommendations').select('*').eq('patient_id', pid).order('created_at', { ascending: false });

	if (status) {
		q = q.eq('status', status);
	}

	const { data: rows, error } = await q;

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	let list = rows || [];
	if (category) {
		list = list.filter((r) => r.metadata?.category === category);
	}

	logger.info(`Fetched ${list.length} recommendations for patient ${uid}`);

	res.json(list);
});

/**
 * GET /ai-recommendations/history/timeline — must be registered before `/:id`.
 */
router.get('/history/timeline', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { start_date, end_date } = req.query;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	let reqQuery = supabaseAdmin.from('recommendation_requests').select('*').eq('patient_id', pid).order('created_at', { ascending: false });

	if (start_date) reqQuery = reqQuery.gte('created_at', start_date);
	if (end_date) reqQuery = reqQuery.lte('created_at', end_date);

	const { data: requests } = await reqQuery;

	const { data: recRows } = await supabaseAdmin.from('patient_recommendations').select('id').eq('patient_id', pid);

	const recIds = (recRows || []).map((r) => r.id);

	let history = [];
	if (recIds.length > 0) {
		let hq = supabaseAdmin.from('recommendation_history').select('*').in('recommendation_id', recIds).order('created_at', { ascending: false });
		if (start_date) hq = hq.gte('created_at', start_date);
		if (end_date) hq = hq.lte('created_at', end_date);
		const { data: hist } = await hq;
		history = hist || [];
	}

	const { data: recommendations } = await supabaseAdmin.from('patient_recommendations').select('metadata').eq('patient_id', pid);

	const stats = {
		total_generated: (requests || []).reduce((sum, r) => sum + (r.payload?.count ?? 0), 0),
		total_accepted: history.filter((h) => h.change?.action === 'Accepted').length,
		total_declined: history.filter((h) => h.change?.action === 'Declined').length,
		total_refined: history.filter((h) => h.change?.action === 'Refined').length,
		total_archived: history.filter((h) => h.change?.action === 'Archived').length,
	};

	const avgConfidence =
		(recommendations || []).length > 0
			? (recommendations || []).reduce((sum, rec) => sum + (rec.metadata?.confidence_score || 0), 0) / recommendations.length
			: 0;

	stats.avg_confidence_score = parseFloat(avgConfidence.toFixed(2));

	logger.info(`Fetched recommendation history for patient ${uid}`);

	res.json({
		timeline: (requests || []).map((reqRow) => ({
			date: reqRow.created_at,
			type: 'Initial',
			focus_area: reqRow.payload?.focus_area,
			count: reqRow.payload?.count,
			status: reqRow.payload?.status,
		})),
		history,
		statistics: stats,
	});
});

/**
 * GET /ai-recommendations/:id
 */
router.get('/:id', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { id } = req.params;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	const { data: recommendation, error } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('id', id)
		.eq('patient_id', pid)
		.maybeSingle();

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	if (!recommendation) {
		return res.status(404).json({ error: 'Not found' });
	}

	logger.info(`Fetched recommendation ${id} for patient ${uid}`);

	res.json(recommendation);
});

/**
 * PUT /ai-recommendations/:id
 */
router.put('/:id', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { id } = req.params;
	const { status, user_notes, refined_actions } = req.body;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	const { data: existing, error: fetchErr } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('id', id)
		.eq('patient_id', pid)
		.maybeSingle();

	if (fetchErr) {
		return res.status(500).json({ error: fetchErr.message });
	}

	if (!existing) {
		return res.status(404).json({ error: 'Not found' });
	}

	const meta = { ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}) };
	if (user_notes) meta.user_notes = user_notes;
	if (refined_actions) meta.refined_actions = refined_actions;
	if (status === 'Accepted') meta.accepted_at = new Date().toISOString();

	const updatePayload = {
		...(status && { status }),
		metadata: meta,
		updated_at: new Date().toISOString(),
	};

	const { data: updatedRecommendation, error: upErr } = await supabaseAdmin
		.from('patient_recommendations')
		.update(updatePayload)
		.eq('id', id)
		.select()
		.single();

	if (upErr) {
		return res.status(500).json({ error: upErr.message });
	}

	try {
		await supabaseAdmin.from('recommendation_history').insert({
			recommendation_id: id,
			change: {
				action: status || 'Updated',
				notes: user_notes || '',
				user_id: uid,
			},
		});
	} catch (error) {
		logger.warn(`Failed to create recommendation history: ${error.message}`);
	}

	logger.info(`Updated recommendation ${id} for patient ${uid}`);

	res.json(updatedRecommendation);
});

/**
 * POST /ai-recommendations/:id/accept
 */
router.post('/:id/accept', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { id } = req.params;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	const { data: existing } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('id', id)
		.eq('patient_id', pid)
		.maybeSingle();

	if (!existing) {
		return res.status(404).json({ error: 'Not found' });
	}

	const acceptedAt = new Date().toISOString();
	const meta = { ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}), accepted_at: acceptedAt };

	await supabaseAdmin
		.from('patient_recommendations')
		.update({ status: 'Accepted', metadata: meta, updated_at: acceptedAt })
		.eq('id', id);

	try {
		await supabaseAdmin.from('recommendation_history').insert({
			recommendation_id: id,
			change: { action: 'Accepted', user_id: uid },
		});
	} catch (error) {
		logger.warn(`Failed to create recommendation history: ${error.message}`);
	}

	logger.info(`Recommendation ${id} accepted by patient ${uid}`);

	res.json({
		success: true,
		message: 'Recommendation accepted',
	});
});

/**
 * POST /ai-recommendations/:id/decline
 */
router.post('/:id/decline', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { id } = req.params;
	const { reason, notes } = req.body;

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	const { data: existing } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('id', id)
		.eq('patient_id', pid)
		.maybeSingle();

	if (!existing) {
		return res.status(404).json({ error: 'Not found' });
	}

	const declinedAt = new Date().toISOString();
	const meta = {
		...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
		declined_at: declinedAt,
		decline_reason: reason || '',
	};

	await supabaseAdmin
		.from('patient_recommendations')
		.update({ status: 'Declined', metadata: meta, updated_at: declinedAt })
		.eq('id', id);

	try {
		await supabaseAdmin.from('recommendation_history').insert({
			recommendation_id: id,
			change: {
				action: 'Declined',
				notes: notes || reason || '',
				user_id: uid,
			},
		});
	} catch (error) {
		logger.warn(`Failed to create recommendation history: ${error.message}`);
	}

	logger.info(`Recommendation ${id} declined by patient ${uid}`);

	res.json({
		success: true,
		message: 'Recommendation declined',
	});
});

/**
 * POST /ai-recommendations/:id/refine
 */
router.post('/:id/refine', supabaseAuth, async (req, res) => {
	const uid = requireUser(req, res);
	if (!uid) return;

	const { id } = req.params;
	const { refined_actions, user_notes } = req.body;

	if (!refined_actions || !Array.isArray(refined_actions)) {
		return res.status(400).json({
			error: 'Missing required field: refined_actions (must be an array)',
		});
	}

	if (!user_notes) {
		return res.status(400).json({
			error: 'Missing required field: user_notes',
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(uid);

	const { data: existing } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('id', id)
		.eq('patient_id', pid)
		.maybeSingle();

	if (!existing) {
		return res.status(404).json({ error: 'Not found' });
	}

	const refinedAt = new Date().toISOString();
	const meta = {
		...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
		refined_actions,
		user_notes,
		refined_at: refinedAt,
	};

	const { data: updatedRecommendation, error } = await supabaseAdmin
		.from('patient_recommendations')
		.update({
			status: 'Refined',
			metadata: meta,
			updated_at: refinedAt,
		})
		.eq('id', id)
		.select()
		.single();

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	try {
		await supabaseAdmin.from('recommendation_history').insert({
			recommendation_id: id,
			change: {
				action: 'Refined',
				notes: user_notes,
				user_id: uid,
			},
		});
	} catch (e) {
		logger.warn(`Failed to create recommendation history: ${e.message}`);
	}

	logger.info(`Recommendation ${id} refined by patient ${uid}`);

	res.json(updatedRecommendation);
});

export default router;
