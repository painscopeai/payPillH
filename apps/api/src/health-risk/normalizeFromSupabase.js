import {
	parseCommaList,
	normalizeConditionPhrases,
	hasSecondaryCvd,
	inferDiabetesStatus,
	inferTreatedHypertension,
	inferSmokingStatus,
	familyHistoryCoronaryText,
} from './parseFreeText.js';
import { systolicFromMetrics, diastolicFromMetrics as diastolicFromMetricsImported } from './vitalsExtract.js';

/**
 * Merge Health Records condition names with onboarding step4; re-derive condition flags.
 */
export function mergeExtraConditionPhrasesIntoFacts(facts, mergedOnboarding, extraPhrases) {
	const s4 = mergedOnboarding?.step4 || {};
	const s5 = mergedOnboarding?.step5 || {};
	const s7 = mergedOnboarding?.step7 || {};
	const s11 = mergedOnboarding?.step11 || {};
	const fromOnboarding = parseCommaList(s4.conditions_list || '');
	const { normalized: combined } = normalizeConditionPhrases([...fromOnboarding, ...extraPhrases]);
	const medsText = s5.medications_list || '';
	const dm = inferDiabetesStatus(combined, medsText);
	const rxHt = inferTreatedHypertension(combined, medsText);
	const secondaryCvd = hasSecondaryCvd(combined);
	const smoking = inferSmokingStatus(s11.lifestyle || '');
	const fhPositive = familyHistoryCoronaryText(s7.family_history || '');
	return {
		...facts,
		normalizedConditions: combined,
		diabetesType1: dm.type1,
		diabetesType2: dm.type2,
		treatedHypertension: rxHt,
		secondaryCvdLikely: secondaryCvd,
		smokingStatusQrisk: smoking.status,
		smokingConfidence: smoking.confidence,
		familyHistoryCHDFLAG: fhPositive,
	};
}

export function mergeStepPayload(draftObj, payloadObj) {
	const out = { ...(draftObj || {}) };
	for (const k of Object.keys(payloadObj || {})) {
		if (/^step\d+$/.test(k) && payloadObj[k] && typeof payloadObj[k] === 'object') {
			out[k] = { ...(draftObj?.[k] || {}), ...payloadObj[k] };
		}
	}
	return out;
}

function parseNumber(val) {
	if (val === undefined || val === null || val === '') return null;
	const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

function ageFromIsoDate(iso) {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	const today = new Date();
	let age = today.getFullYear() - d.getFullYear();
	const m = today.getMonth() - d.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
	return Math.max(0, age);
}

function sexFromOnboarding(step2, profile) {
	const raw = (step2?.sex_assigned_at_birth || '').toString().trim().toLowerCase();
	if (raw.startsWith('m')) return 'male';
	if (raw.startsWith('f')) return 'female';
	return 'unknown';
}

/**
 * @param {object|null} profile
 * @param {string} userId
 * @param {Record<string, unknown>} merged
 * @param {Array<{ metrics?: object, measured_at?: string, created_at?: string }>} sortedVitals chronological
 * @param {string|null} patientId
 */
export function buildNormalizedFromMerge(profile, userId, merged, sortedVitals, patientId) {
	const s2 = merged.step2 || {};
	const s3 = merged.step3 || {};
	const s4 = merged.step4 || {};
	const s5 = merged.step5 || {};
	const s7 = merged.step7 || {};
	const s11 = merged.step11 || {};

	const dobStr =
		s2.date_of_birth || profile?.date_of_birth || null;
	const ageYears = dobStr ? ageFromIsoDate(typeof dobStr === 'string' ? dobStr : dobStr.toString()) : null;

	let heightCm = parseNumber(s3.height);
	let weightKg = parseNumber(s3.weight);
	let bmi = parseNumber(s3.bmi);
	if (bmi == null && heightCm && weightKg && heightCm > 0) {
		const hm = heightCm / 100;
		bmi = Math.round((weightKg / (hm * hm)) * 10) / 10;
	}

	let systolic = parseNumber(s3.blood_pressure_systolic);
	let diastolic = parseNumber(s3.blood_pressure_diastolic);
	let restingHr = parseNumber(s3.resting_heart_rate);

	if (sortedVitals.length > 0) {
		const latest = sortedVitals[sortedVitals.length - 1];
		const sys = systolicFromMetrics(latest.metrics);
		const dia = diastolicFromMetricsImported(latest.metrics);
		if (sys != null) systolic = sys;
		if (dia != null) diastolic = dia;
		const hr = parseNumber(latest.metrics?.resting_heart_rate ?? latest.metrics?.heart_rate);
		if (hr != null) restingHr = hr;
		const bmiV = parseNumber(latest.metrics?.bmi);
		if (bmiV != null) bmi = bmiV;
	}

	const conditionPhrases = parseCommaList(s4.conditions_list || '');
	const { normalized: normalizedConditions } = normalizeConditionPhrases(conditionPhrases);
	const medsText = s5.medications_list || '';

	const dm = inferDiabetesStatus(normalizedConditions, medsText);
	const rxHt = inferTreatedHypertension(normalizedConditions, medsText);
	const secondaryCvd = hasSecondaryCvd(normalizedConditions);
	const smoking = inferSmokingStatus(s11.lifestyle || '');
	const fhPositive = familyHistoryCoronaryText(s7.family_history || '');

	const sexAtBirthMapped = sexFromOnboarding(s2, profile);

	return {
		userId,
		mergedOnboarding: merged,
		profile,
		patientId,
		facts: {
			ageYears,
			sexAtBirth: sexAtBirthMapped,
			bmi,
			systolicBp: systolic,
			diastolicBp: diastolic,
			restingHr,
			normalizedConditions,
			medsText,
			diabetesType1: dm.type1,
			diabetesType2: dm.type2,
			treatedHypertension: rxHt,
			secondaryCvdLikely: secondaryCvd,
			smokingStatusQrisk: smoking.status,
			smokingConfidence: smoking.confidence,
			familyHistoryCHDFLAG: fhPositive,
			lifestyleText: s11.lifestyle || '',
			vitalsRowsChronological: sortedVitals,
		},
	};
}

/**
 * Fast path for dashboard: **one** `profiles` row only (production timeouts).
 * Uses `onboarding_draft` steps only — no `patients` / `patient_profiles` / `vitals` queries.
 */
const PROFILE_QUERY_MS = 12000;

export async function normalizeFromProfileOnly(supabaseAdmin, userId) {
	if (!supabaseAdmin || !userId) {
		throw new Error('normalizeFromProfileOnly: missing admin client or userId');
	}

	const run = async () => {
		const { data: profile, error: pErr } = await supabaseAdmin
			.from('profiles')
			.select(
				'id, email, first_name, last_name, date_of_birth, onboarding_draft, onboarding_completed'
			)
			.eq('id', userId)
			.maybeSingle();
		if (pErr) throw pErr;

		const draft = profile?.onboarding_draft && typeof profile.onboarding_draft === 'object' ? profile.onboarding_draft : {};
		const merged = mergeStepPayload(draft, {});

		return buildNormalizedFromMerge(profile, userId, merged, [], null);
	};

	return await Promise.race([
		run(),
		new Promise((_, rej) =>
			setTimeout(() => rej(new Error('profiles_query_timeout')), PROFILE_QUERY_MS)
		),
	]);
}

/**
 * Full normalization: profile + patient_profiles payload + vitals table (slower; not used for dashboard GET).
 */
export async function normalizeFromSupabase(supabaseAdmin, userId) {
	if (!supabaseAdmin || !userId) {
		throw new Error('normalizeFromSupabase: missing admin client or userId');
	}

	const { data: profile, error: pErr } = await supabaseAdmin
		.from('profiles')
		.select(
			'id, email, first_name, last_name, date_of_birth, onboarding_draft, onboarding_completed'
		)
		.eq('id', userId)
		.maybeSingle();
	if (pErr) throw pErr;

	const draft = profile?.onboarding_draft && typeof profile.onboarding_draft === 'object' ? profile.onboarding_draft : {};

	const { data: patientRow } = await supabaseAdmin.from('patients').select('id').eq('user_id', userId).maybeSingle();

	let payloadFromProfile = {};
	if (patientRow?.id) {
		const { data: pp } = await supabaseAdmin
			.from('patient_profiles')
			.select('payload, updated_at')
			.eq('patient_id', patientRow.id)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (pp?.payload && typeof pp.payload === 'object') payloadFromProfile = pp.payload;
	}

	const merged = mergeStepPayload(draft, payloadFromProfile);

	const { data: vitalsRows } = await supabaseAdmin
		.from('vitals')
		.select('metrics, measured_at, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(30);

	const sortedVitals = (vitalsRows || []).slice().sort((a, b) => {
		const ta = new Date(a.measured_at || a.created_at || 0).getTime();
		const tb = new Date(b.measured_at || b.created_at || 0).getTime();
		return ta - tb;
	});

	return buildNormalizedFromMerge(profile, userId, merged, sortedVitals, patientRow?.id ?? null);
}
