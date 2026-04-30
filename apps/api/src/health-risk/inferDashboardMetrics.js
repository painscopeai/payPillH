import { ENGINE_VERSION } from './engineVersion.js';
import { normalizeFromSupabase } from './normalizeFromSupabase.js';
import { computeFallbackComposite, computeChronicBurdenIndex } from './fallbackComposite.js';
import { buildPreventiveGaps } from './preventiveHints.js';
import { buildVitalsSeries } from './vitalsSeries.js';
import { fetchPreviousSnapshot, insertSnapshot, shouldInsertSnapshot } from './snapshotMetrics.js';

/** Return recent snapshot without recomputing (cuts latency on dashboard refreshes). */
const CACHE_TTL_MINUTES = 20;

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
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 * @param {{ persistSnapshot?: boolean }} [opts]
 */
export async function inferDashboardMetrics(supabaseAdmin, userId, opts = {}) {
	const { persistSnapshot = true } = opts;

	const prior = await fetchPreviousSnapshot(supabaseAdmin, userId);

	if (prior?.metrics?.summary && prior.created_at) {
		const ageMin = (Date.now() - new Date(prior.created_at).getTime()) / 60000;
		const cached = prior.metrics.summary;
		if (
			ageMin < CACHE_TTL_MINUTES &&
			cached?.engineVersion === ENGINE_VERSION &&
			cached?.cvd?.method === 'WELLNESS_SCORE'
		) {
			return cached;
		}
	}

	const normalized = await normalizeFromSupabase(supabaseAdmin, userId);
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

	let cvdDeltaPercent = null;
	let hasHistory = false;
	if (prior?.metrics?.summary?.cvd) {
		const p = prior.metrics.summary.cvd;
		hasHistory = true;
		if (typeof p.value === 'number' && typeof cvdValue === 'number') {
			cvdDeltaPercent = Math.round((cvdValue - p.value) * 10) / 10;
		}
	}

	const labelInfo = categorizeScoreBand(cvdValue);

	const summary = {
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
			cvdDeltaPercent,
			hasHistory,
			previousCapturedAt: prior?.created_at ?? null,
		},
		provenance: {
			confidence: confidenceFromImputation(imputedFields.length, facts),
			sources: ['onboarding', 'profile', 'vitals'],
		},
	};

	const envelope = {
		engineVersion: ENGINE_VERSION,
		method: 'WELLNESS_SCORE',
		trendKey: cvdValue,
		summary,
		computedAt: new Date().toISOString(),
	};

	if (persistSnapshot && supabaseAdmin && (await shouldInsertSnapshot(supabaseAdmin, userId, 6, prior))) {
		await insertSnapshot(supabaseAdmin, userId, envelope);
	}

	return summary;
}
