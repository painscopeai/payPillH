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

function mergeStepPayload(draftObj, payloadObj) {
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
 * Extract systolic BP from vitals metrics JSON.
 */
/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
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

	if (sortedVitals.length > 0) {
		const latest = sortedVitals[0];
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
		patientId: patientRow?.id ?? null,
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
			/** Oldest → newest for charting. */
			vitalsRowsChronological: sortedVitals,
		},
	};
}
