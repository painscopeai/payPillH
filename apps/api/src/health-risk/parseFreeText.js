/**
 * Deterministic parsing of comma-separated free-text lists for conditions/meds.
 */

const CONDITION_SYNONYMS = [
	[/\bt2dm\b|\btype\s*2\s*diabetes\b|\bdm2\b/i, 'type 2 diabetes'],
	[/\bt1dm\b|\btype\s*1\s*diabetes\b/i, 'type 1 diabetes'],
	[/\bhtn\b|\bhypertension\b|\bhigh\s*blood\s*pressure\b/i, 'hypertension'],
	[/\baf\b|\batrial\s*fibrillation\b|\bafib\b/i, 'atrial fibrillation'],
	[/\bckd\b|\bchronic\s*kidney\b/i, 'chronic kidney disease'],
	[/\bcopd\b/i, 'copd'],
	[/\bmi\b|\bmyocardial\s*infarction\b|\bheart\s*attack\b/i, 'myocardial infarction'],
	[/\bstroke\b|\bcva\b|\btia\b/i, 'stroke'],
	[/\bangina\b|\bcoronary\b|\bheart\s*disease\b|\bihd\b/i, 'coronary heart disease'],
	[/\bpad\b|\bperipheral\s*arterial\b/i, 'peripheral arterial disease'],
];

const SECONDARY_CVD = [
	'myocardial infarction',
	'stroke',
	'coronary heart disease',
	'angina',
	'peripheral arterial disease',
];

const ANTIHYPERTENSIVE_HINTS =
	/\blisinopril\b|\benalapril\b|\bramipril\b|\bamlodipine\b|\bmetoprolol\b|\bbisoprolol\b|\batenolol\b|\bpropranolol\b|\bhydrochlorothiazide\b|\bendapamide\b|\binspra\b|\bspironolactone\b|\blozartan\b|\bvalsartan\b|\btelmisartan\b|\bcandesartan\b|\bperindopril\b|\bindapamide\b/i;

const METFORMIN_CLASS = /\bmetformin\b/i;
const INSULIN_CLASS = /\binsulin\b/i;

/**
 * @param {string} [text]
 * @returns {string[]}
 */
export function parseCommaList(text) {
	if (!text || typeof text !== 'string') return [];
	return text
		.split(/[,;\n]+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => s.replace(/\s+/g, ' '));
}

/**
 * @param {string[]} phrases
 * @returns {{ normalized: string[], unknownTokens: string[] }}
 */
export function normalizeConditionPhrases(phrases) {
	const normalized = [];
	const unknownTokens = [];
	for (const raw of phrases) {
		const lower = raw.toLowerCase();
		let mapped = lower;
		for (const [re, canon] of CONDITION_SYNONYMS) {
			if (re.test(lower)) {
				mapped = canon;
				break;
			}
		}
		normalized.push(mapped);
		if (!CONDITION_SYNONYMS.some(([re]) => re.test(lower)) && mapped === lower && lower.split(/\s+/).length > 3) {
			unknownTokens.push(raw);
		}
	}
	return { normalized, unknownTokens };
}

export function hasSecondaryCvd(normalizedConditions) {
	const set = new Set(normalizedConditions.map((s) => s.toLowerCase()));
	for (const k of SECONDARY_CVD) {
		for (const c of set) {
			if (c.includes(k)) return true;
		}
	}
	return false;
}

export function inferDiabetesStatus(normalizedConditions, medsText) {
	const joined = normalizedConditions.join(' ').toLowerCase();
	const mt = (medsText || '').toLowerCase();
	const t1 = joined.includes('type 1 diabetes') || /\btype\s*1\s*diabetes\b/i.test(joined);
	if (t1) return { type1: true, type2: false };
	const t2 = joined.includes('type 2 diabetes') || /\btype\s*2\s*diabetes\b/i.test(joined);
	if (t2) return { type1: false, type2: true };
	if (/\bdiabetes\b/i.test(joined)) return { type1: false, type2: true };
	if (METFORMIN_CLASS.test(mt)) return { type1: false, type2: true };
	if (INSULIN_CLASS.test(mt)) return { type1: false, type2: true };
	return { type1: false, type2: false };
}

export function inferTreatedHypertension(normalizedConditions, medsText) {
	const hasDx = normalizedConditions.some((c) => c.toLowerCase().includes('hypertension'));
	const hasMeds = ANTIHYPERTENSIVE_HINTS.test(medsText || '');
	return (hasDx && hasMeds) || hasMeds;
}

/**
 * Map lifestyle text to smoking intensity bands:
 * 0 non, 1 former, 2 light, 3 moderate, 4 heavy
 */
export function inferSmokingStatus(lifestyleText) {
	const t = (lifestyleText || '').toLowerCase();
	if (!t.trim()) return { status: 0, confidence: 'low' };
	if (/\b(never\s*smoked|non[\s-]*smoker|non smoker)\b/i.test(t)) return { status: 0, confidence: 'medium' };
	if (/\b(ex[\s-]*smoker|former|quit\s*smoking|stopped\s*smoking)\b/i.test(t)) return { status: 1, confidence: 'medium' };
	if (/\b(pipe|cigar|occasional)\b/i.test(t)) return { status: 2, confidence: 'low' };
	if (/\b(pack|20|heavy|chain)\b/i.test(t)) return { status: 4, confidence: 'low' };
	if (/\b(smoke|smoking|cigarette)\b/i.test(t)) return { status: 3, confidence: 'low' };
	return { status: 0, confidence: 'low' };
}

export function familyHistoryCoronaryText(text) {
	const t = (text || '').toLowerCase();
	return /\b(heart\s*attack|mi|angina|coronary|stroke|chd)\b/i.test(t);
}
