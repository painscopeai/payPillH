import 'dotenv/config';
import { Router } from 'express';
import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { ensurePatientForUser } from '../lib/ensurePatient.js';
import logger from '../utils/logger.js';
import { supabaseAuth } from '../middleware/supabase-auth.js';
import { preparePatientDataForAnalysis } from '../utils/healthDataAnalyzer.js';

const router = Router();

/**
 * Compile patient data for the alternate Gemini prompt shape used by this route.
 */
async function fetchPatientData(userId) {
	logger.info(`[ai-recommendations] Fetching patient data for user: ${userId}`);

	const hd = await preparePatientDataForAnalysis(userId);

	const patientData = {
		userId,
		profile: { age: hd.age, gender: hd.gender },
		conditions: (hd.conditions || []).map((name) => ({ name, status: 'active' })),
		medications: (hd.medications || []).map((m) => ({
			name: m.name,
			dosage: m.dosage,
			frequency: m.frequency,
			status: 'active',
		})),
		allergies: (hd.allergies || []).map((text) => ({
			allergen: text,
			severity: 'unknown',
			reaction: '',
		})),
		medicalHistory: (hd.family_history || []).map((line) => ({
			event: line,
			date: null,
			description: '',
		})),
		labHistory: (hd.lab_results || []).map((l) => ({
			testName: l.test_name,
			result: l.result_value,
			unit: l.unit,
			referenceRange: l.reference_range,
			testDate: l.test_date,
		})),
		lifestyle: {
			smokingStatus: hd.lifestyle?.smoking_status,
			alcoholConsumption: hd.lifestyle?.alcohol_consumption,
			exerciseLevel: hd.lifestyle?.exercise_level,
			sleepQuality: hd.lifestyle?.sleep_quality,
			diet: hd.lifestyle?.diet,
			stress: hd.lifestyle?.stress,
		},
		immunizations: [],
		vitals: hd.vitals || {},
	};

	if (supabaseAdmin) {
		try {
			const pid = await ensurePatientForUser(userId);
			const { data: imms } = await supabaseAdmin.from('patient_immunizations').select('payload').eq('patient_id', pid).limit(50);
			patientData.immunizations = (imms || []).map((row) => ({
				vaccine: row.payload?.vaccine_name ?? row.payload?.name ?? 'Immunization',
				date: row.payload?.date ?? row.payload?.vaccination_date,
				status: row.payload?.status || 'completed',
			}));
		} catch (error) {
			logger.warn(`[ai-recommendations] immunizations: ${error.message}`);
		}
	}

	logger.info(`[ai-recommendations] Patient data compilation complete for user: ${userId}`);
	return patientData;
}

function formatPatientDataForPrompt(patientData) {
	const lines = [];

	lines.push('=== PATIENT HEALTH PROFILE ===');
	lines.push('');

	if (patientData.profile) {
		if (patientData.profile.age) lines.push(`Age: ${patientData.profile.age}`);
		if (patientData.profile.gender) lines.push(`Gender: ${patientData.profile.gender}`);
		lines.push('');
	}

	if (patientData.conditions.length > 0) {
		lines.push('Current Medical Conditions:');
		patientData.conditions.forEach((c) => {
			lines.push(`  - ${c.name} (${c.status})`);
		});
		lines.push('');
	}

	if (patientData.medications.length > 0) {
		lines.push('Current Medications:');
		patientData.medications.forEach((m) => {
			lines.push(`  - ${m.name} ${m.dosage} (${m.frequency})`);
		});
		lines.push('');
	}

	if (patientData.allergies.length > 0) {
		lines.push('Allergies:');
		patientData.allergies.forEach((a) => {
			lines.push(`  - ${a.allergen} (${a.severity}): ${a.reaction || 'Not specified'}`);
		});
		lines.push('');
	}

	if (patientData.labHistory.length > 0) {
		lines.push('Recent Lab Results:');
		patientData.labHistory.slice(0, 10).forEach((l) => {
			lines.push(`  - ${l.testName}: ${l.result} ${l.unit || ''} (${l.testDate})`);
		});
		lines.push('');
	}

	if (patientData.medicalHistory.length > 0) {
		lines.push('Medical History:');
		patientData.medicalHistory.slice(0, 5).forEach((h) => {
			lines.push(`  - ${h.event} (${h.date}): ${h.description || 'No details'}`);
		});
		lines.push('');
	}

	if (Object.keys(patientData.lifestyle).length > 0) {
		lines.push('Lifestyle Factors:');
		if (patientData.lifestyle.smokingStatus) lines.push(`  - Smoking: ${patientData.lifestyle.smokingStatus}`);
		if (patientData.lifestyle.alcoholConsumption) lines.push(`  - Alcohol: ${patientData.lifestyle.alcoholConsumption}`);
		if (patientData.lifestyle.exerciseLevel) lines.push(`  - Exercise: ${patientData.lifestyle.exerciseLevel}`);
		if (patientData.lifestyle.sleepQuality) lines.push(`  - Sleep: ${patientData.lifestyle.sleepQuality}`);
		if (patientData.lifestyle.diet) lines.push(`  - Diet: ${patientData.lifestyle.diet}`);
		if (patientData.lifestyle.stress) lines.push(`  - Stress Level: ${patientData.lifestyle.stress}`);
		lines.push('');
	}

	if (patientData.immunizations.length > 0) {
		lines.push('Immunizations:');
		patientData.immunizations.forEach((i) => {
			lines.push(`  - ${i.vaccine} (${i.date}): ${i.status}`);
		});
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * POST /ai-recommendations — Gemini suggestions only (no DB persistence); see POST /recommendations for saved rows.
 */
router.post('/', supabaseAuth, async (req, res) => {
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	const { focus_area, include_history } = req.body;

	logger.info(`[ai-recommendations] POST request from user: ${userId}`);

	const geminiApiKey = process.env.GEMINI_API_KEY;
	if (!geminiApiKey) {
		logger.error('[ai-recommendations] GEMINI_API_KEY is not configured');
		return res.status(500).json({ error: 'GEMINI_API_KEY is not configured. Please set it in .env file.' });
	}

	let patientData;
	try {
		patientData = await fetchPatientData(userId);
	} catch (error) {
		logger.error(`[ai-recommendations] Error fetching patient data: ${error.message}`);
		return res.status(500).json({ error: `Failed to fetch patient data: ${error.message}` });
	}

	const hasVitals =
		patientData.vitals &&
		Object.keys(patientData.vitals).some((k) => k !== 'recorded_at' && patientData.vitals[k] != null && patientData.vitals[k] !== '');

	const hasHealthData =
		patientData.conditions.length > 0 ||
		patientData.medications.length > 0 ||
		patientData.allergies.length > 0 ||
		patientData.labHistory.length > 0 ||
		patientData.medicalHistory.length > 0 ||
		Object.values(patientData.lifestyle || {}).some(Boolean) ||
		patientData.immunizations.length > 0 ||
		hasVitals;

	if (!hasHealthData) {
		logger.warn(`[ai-recommendations] No health data found for user: ${userId}`);
		return res.status(400).json({
			error: 'Insufficient patient data',
			message:
				'Patient profile must contain at least one of: conditions, medications, allergies, lab results, medical history, lifestyle information, immunizations, or vitals',
		});
	}

	const patientDataText = formatPatientDataForPrompt(patientData);
	logger.debug(`[ai-recommendations] Formatted patient data:\n${patientDataText}`);

	const userPrompt = `Analyze this patient's health profile and generate personalized health recommendations:\n\n${patientDataText}\n\nFocus Area: ${focus_area || 'comprehensive'}\nInclude History: ${include_history || false}\n\nGenerate 5-10 personalized health recommendations. Return ONLY a valid JSON array with this structure:\n[\n  {\n    "title": "Recommendation title",\n    "description": "Detailed description",\n    "priority": "high|medium|low",\n    "relatedConditions": ["condition1"],\n    "suggestedActions": ["action1"],\n    "sources": ["source1"],\n    "confidenceScore": 0.85\n  }\n]`;

	const systemPrompt = `You are a healthcare AI assistant for PayPill specializing in personalized health insights and recommendations. You have access to the user's complete health profile including conditions, medications, vitals, lifestyle, and family history. Your role is to: (1) Analyze medication interactions and safety concerns, (2) Recommend generic alternatives for current medications with cost savings estimates, (3) Suggest preventive care based on conditions, age, and risk factors, (4) Provide lifestyle and wellness recommendations based on health data, (5) Identify medication adherence issues and suggest solutions, (6) Recommend nearby healthcare providers (pharmacists, physiotherapists, specialists) based on user's conditions and location, (7) Provide evidence-based clinical guidance referencing current research and guidelines. Additionally, analyze user health data including: health profile, current medications, pre-existing conditions, lifestyle habits, health goals, and vital signs trends. Generate personalized, actionable health recommendations in categories: medication management, preventive care, lifestyle changes, lab tests, specialist referrals, vaccinations, and health screenings. Provide evidence-based insights with clear reasoning. Format recommendations clearly with priority levels (high/medium/low) and actionable next steps. Always prioritize patient safety, be empathetic, and recommend consulting healthcare providers for major decisions.`;

	const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

	logger.info('[ai-recommendations] Calling Gemini API');

	let geminiResponse;
	try {
		geminiResponse = await axios.post(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
			{
				contents: [
					{
						parts: [{ text: fullPrompt }],
					},
				],
			},
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return res.status(502).json({ error: error.message });
	}

	if (!geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
		logger.error('[ai-recommendations] Invalid response from Gemini API: missing content');
		return res.status(502).json({ error: 'Invalid response from Gemini API: missing content' });
	}

	const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
	logger.info('[ai-recommendations] Gemini API response received');

	let recommendations = [];
	try {
		const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
		const jsonString = jsonMatch ? jsonMatch[0] : responseText;
		recommendations = JSON.parse(jsonString);
		logger.info(`[ai-recommendations] Parsed ${recommendations.length} recommendations from Gemini response`);
	} catch (parseError) {
		logger.error(`[ai-recommendations] Failed to parse Gemini response as JSON: ${parseError.message}`);
		return res.status(502).json({ error: 'Failed to parse recommendations from Gemini API response' });
	}

	const formattedRecommendations = recommendations
		.filter((rec) => rec && rec.title && rec.description)
		.map((rec, index) => ({
			id: `rec_${userId}_${Date.now()}_${index}`,
			title: rec.title || '',
			description: rec.description || '',
			priority: rec.priority || 'medium',
			relatedConditions: Array.isArray(rec.relatedConditions) ? rec.relatedConditions : [],
			suggestedActions: Array.isArray(rec.suggestedActions) ? rec.suggestedActions : [],
			sources: Array.isArray(rec.sources) ? rec.sources : [],
			confidenceScore: typeof rec.confidenceScore === 'number' ? rec.confidenceScore : 0.5,
		}));

	logger.info(`[ai-recommendations] Generated ${formattedRecommendations.length} formatted recommendations for user ${userId}`);

	res.json({
		success: true,
		recommendations: formattedRecommendations,
		generatedAt: new Date().toISOString(),
	});
});

/**
 * GET /ai-recommendations
 */
router.get('/', supabaseAuth, async (req, res) => {
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(userId);

	const { data: rows, error } = await supabaseAdmin
		.from('patient_recommendations')
		.select('*')
		.eq('patient_id', pid)
		.order('created_at', { ascending: false })
		.limit(100);

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	logger.info(`[ai-recommendations] Fetched ${(rows || []).length} recommendations for user ${userId}`);

	res.json(rows || []);
});

/**
 * GET /ai-recommendations/:id
 */
router.get('/:id', supabaseAuth, async (req, res) => {
	const { id } = req.params;
	const userId = req.user?.id;
	if (!userId) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const pid = await ensurePatientForUser(userId);

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
		logger.warn(`[ai-recommendations] Unauthorized or missing: user ${userId} recommendation ${id}`);
		return res.status(404).json({ error: 'Not found' });
	}

	logger.info(`[ai-recommendations] Retrieved recommendation ${id}`);

	res.json(recommendation);
});

export default router;
