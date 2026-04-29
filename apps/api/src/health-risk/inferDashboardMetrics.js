import { ENGINE_VERSION } from './engineVersion.js';
import { normalizeFromSupabase } from './normalizeFromSupabase.js';
import { computeFallbackComposite, computeChronicBurdenIndex } from './fallbackComposite.js';
import { runQrisk3, getClinRiskDisclaimer } from './qriskRunner.js';
import { buildPreventiveGaps } from './preventiveHints.js';
import { buildVitalsSeries } from './vitalsSeries.js';
import { fetchPreviousSnapshot, insertSnapshot, shouldInsertSnapshot } from './snapshotMetrics.js';

function deriveLipidsKnown(merged) {
	const s3 = merged?.step3 || {};
	return !!(s3.total_cholesterol || s3.hdl_cholesterol || s3.cholesterol || s3.ldl);
}

function confidenceFromImputation(imputedCount, facts) {
	if (facts.ageYears == null || facts.sexAtBirth === 'unknown') return 'low';
	if (imputedCount >= 4) return 'low';
	if (imputedCount >= 2) return 'medium';
	return 'high';
}

function categorizeCvdLabel(method, value) {
	if (method === 'QRISK3') {
		if (value < 10) return { band: 'low', subtitle: 'Lower estimated 10-year cardiovascular risk' };
		if (value < 20) return { band: 'moderate', subtitle: 'Moderate estimated risk — discuss with a clinician' };
		return { band: 'high', subtitle: 'Higher estimated risk — seek clinical advice' };
	}
	if (value < 25) return { band: 'low', subtitle: 'Lower composite wellness index' };
	if (value < 50) return { band: 'moderate', subtitle: 'Moderate composite index' };
	return { band: 'high', subtitle: 'Higher composite index — discuss with a clinician' };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ persistSnapshot?: boolean }} [opts]
 */
export async function inferDashboardMetrics(supabaseAdmin, userId, opts = {}) {
	const { persistSnapshot = true } = opts;

	const normalized = await normalizeFromSupabase(supabaseAdmin, userId);
	const facts = normalized.facts;
	facts.lipidsKnown = deriveLipidsKnown(normalized.mergedOnboarding);

	const imputedFields = [];
	let cvdMethod = 'RULE_FALLBACK';
	let cvdValue = 0;
	let fallbackReason = null;
	let qriskDisclaimer = getClinRiskDisclaimer();

	if (facts.secondaryCvdLikely) {
		fallbackReason = 'secondary_prevention_qrisk_not_indicated';
		const fb = computeFallbackComposite(facts);
		cvdValue = fb.index;
		cvdMethod = 'RULE_FALLBACK';
	} else if (facts.sexAtBirth === 'unknown' || facts.ageYears == null) {
		fallbackReason = 'missing_age_or_sex';
		const fb = computeFallbackComposite(facts);
		cvdValue = fb.index;
	} else {
		const qr = runQrisk3(facts, imputedFields);
		qriskDisclaimer = qr.Disclaimer || qriskDisclaimer;
		if (qr.percent != null && Number.isFinite(qr.percent)) {
			cvdMethod = 'QRISK3';
			cvdValue = qr.percent;
		} else {
			fallbackReason = qr.error || 'qrisk_unavailable';
			const fb = computeFallbackComposite(facts);
			cvdValue = fb.index;
			cvdMethod = 'RULE_FALLBACK';
		}
	}

	const chronicBurdenIndex = computeChronicBurdenIndex(facts);
	const vitalsSeries = buildVitalsSeries(facts);
	const preventiveGaps = buildPreventiveGaps(facts);

	// Always load last snapshot for trend deltas; persistence is gated separately below.
	const prior = await fetchPreviousSnapshot(supabaseAdmin, userId);
	let cvdDeltaPercent = null;
	let hasHistory = false;
	if (prior?.metrics?.summary?.cvd) {
		const p = prior.metrics.summary.cvd;
		hasHistory = true;
		if (p.method === cvdMethod && typeof p.value === 'number' && typeof cvdValue === 'number') {
			cvdDeltaPercent = Math.round((cvdValue - p.value) * 10) / 10;
		}
	}

	const labelInfo = categorizeCvdLabel(cvdMethod, cvdValue);

	const summary = {
		engineVersion: ENGINE_VERSION,
		disclaimer:
			'Wellness metrics only — not a diagnosis. UK-aligned estimates may use QRISK3-2017 (LGPL); see docs/health-risk-engine/. All medical decisions belong with a qualified clinician.',
		clinRiskDisclaimer: qriskDisclaimer || undefined,
		cvd: {
			value: cvdValue,
			method: cvdMethod,
			unit: cvdMethod === 'QRISK3' ? 'percent_10y_cvd' : 'composite_index_0_100',
			label:
				cvdMethod === 'QRISK3'
					? 'Estimated 10-year cardiovascular risk (QRISK3)'
					: 'Cardiovascular wellness composite index',
			subtitle: labelInfo.subtitle,
			band: labelInfo.band,
			imputedFields,
			fallbackReason,
		},
		chronicBurden: {
			value: chronicBurdenIndex,
			unit: 'index_0_100',
			label: 'Chronic condition burden index',
			subtitle: 'Based on self-reported conditions and family history text',
		},
		adherence: {
			score: null,
			reason: 'insufficient_data',
			subtitle: 'Structured prescription/refill or adherence data not available',
		},
		vitalsSeries,
		preventiveGaps,
		trend: {
			cvdDeltaPercent,
			hasHistory,
			previousCapturedAt: prior?.created_at ?? null,
		},
		provenance: {
			confidence: confidenceFromImputation(imputedFields.length, facts),
			appliedRules: [
				cvdMethod === 'QRISK3' ? 'RULE-QRISK-001' : 'RULE-FB-001',
				'RULE-COND-001',
				'RULE-PREV-001',
				'RULE-VITAL-001',
				'RULE-ADH-001',
			],
			sources: ['patient_profiles.payload', 'profiles.onboarding_draft', 'vitals'],
		},
	};

	const envelope = {
		engineVersion: ENGINE_VERSION,
		method: cvdMethod,
		trendKey: cvdValue,
		summary,
		computedAt: new Date().toISOString(),
	};

	if (persistSnapshot && supabaseAdmin && (await shouldInsertSnapshot(supabaseAdmin, userId))) {
		await insertSnapshot(supabaseAdmin, userId, envelope);
	}

	return summary;
}
