import { ENGINE_VERSION } from './engineVersion.js';
import { normalizeFromProfileOnly } from './normalizeFromSupabase.js';
import { computeFallbackComposite, computeChronicBurdenIndex } from './fallbackComposite.js';
import { buildPreventiveGaps } from './preventiveHints.js';
import { buildVitalsSeries } from './vitalsSeries.js';

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

function categorizeScoreBand(value) {
	if (value < 25) return { band: 'low', subtitle: 'Lower score — keep healthy habits' };
	if (value < 50) return { band: 'moderate', subtitle: 'Moderate score — consider discussing with your clinician' };
	return { band: 'high', subtitle: 'Higher score — seek clinical advice when concerned' };
}

/**
 * Dashboard metrics from **`profiles.onboarding_draft` only** — one Supabase round trip.
 * No snapshot table reads/writes on this path (avoids production timeouts).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ persistSnapshot?: boolean }} [_opts] unused; snapshots disabled for latency
 */
/** Fast fallback so the client always gets a 200 with a valid shape (avoids Vercel FUNCTION_INVOCATION_TIMEOUT UX). */
export function buildDegradedDashboardSummary(reason = 'upstream_timeout') {
	return {
		engineVersion: ENGINE_VERSION,
		degraded: true,
		degradedReason: reason,
		disclaimer:
			'Wellness summary only — not a diagnosis or substitute for medical advice. This response was limited because the service could not finish in time; try refreshing.',
		cvd: {
			value: 0,
			method: 'WELLNESS_SCORE',
			unit: 'score_0_100',
			label: 'Heart & cardiovascular wellness score',
			subtitle: 'Score unavailable — please retry',
			band: 'low',
			imputedFields: [],
			fallbackReason: reason,
		},
		chronicBurden: {
			value: 0,
			unit: 'index_0_100',
			label: 'Chronic condition burden',
			subtitle: 'Unavailable — please retry',
		},
		adherence: {
			score: null,
			reason: 'insufficient_data',
			subtitle: 'Structured prescription data not linked yet',
		},
		vitalsSeries: [],
		preventiveGaps: [],
		trend: {
			cvdDeltaPercent: null,
			hasHistory: false,
			previousCapturedAt: null,
		},
		provenance: {
			confidence: 'low',
			sources: [],
		},
	};
}

export async function inferDashboardMetrics(supabaseAdmin, userId, _opts = {}) {
	const normalized = await normalizeFromProfileOnly(supabaseAdmin, userId);
	const facts = normalized.facts;
	facts.lipidsKnown = deriveLipidsKnown(normalized.mergedOnboarding);

	const imputedFields = [];
	let fallbackReason = null;

	const fb = computeFallbackComposite(facts);
	const cvdValue = fb.index;

	if (facts.secondaryCvdLikely) {
		fallbackReason = 'prior_cardiovascular_history';
	} else if (facts.sexAtBirth === 'unknown' || facts.ageYears == null) {
		fallbackReason = 'missing_age_or_sex_defaults_used';
	}

	const chronicBurdenIndex = computeChronicBurdenIndex(facts);
	const vitalsSeries = buildVitalsSeries(facts);
	const preventiveGaps = buildPreventiveGaps(facts);

	const labelInfo = categorizeScoreBand(cvdValue);

	return {
		engineVersion: ENGINE_VERSION,
		disclaimer:
			'Wellness summary only — not a diagnosis or substitute for medical advice. Discuss results with a qualified clinician.',
		cvd: {
			value: cvdValue,
			method: 'WELLNESS_SCORE',
			unit: 'score_0_100',
			label: 'Heart & cardiovascular wellness score',
			subtitle: labelInfo.subtitle,
			band: labelInfo.band,
			imputedFields,
			fallbackReason,
		},
		chronicBurden: {
			value: chronicBurdenIndex,
			unit: 'index_0_100',
			label: 'Chronic condition burden',
			subtitle: 'From conditions and family history you shared',
		},
		adherence: {
			score: null,
			reason: 'insufficient_data',
			subtitle: 'Structured prescription data not linked yet',
		},
		vitalsSeries,
		preventiveGaps,
		trend: {
			cvdDeltaPercent: null,
			hasHistory: false,
			previousCapturedAt: null,
		},
		provenance: {
			confidence: confidenceFromImputation(imputedFields.length, facts),
			sources: ['profiles.onboarding_draft'],
		},
	};
}
