/**
 * Heuristic wellness composite score (0–100) from onboarding + vitals signals.
 */

function calculateAgeRisk(age) {
	if (age == null || !Number.isFinite(age)) return 15;
	if (age < 30) return 5;
	if (age < 40) return 10;
	if (age < 50) return 15;
	if (age < 60) return 25;
	if (age < 70) return 35;
	if (age < 80) return 45;
	return 55;
}

function calculateConditionRisk(conditions) {
	if (!conditions || !Array.isArray(conditions)) return 0;
	const highRiskConditions = [
		'hypertension',
		'heart disease',
		'coronary',
		'myocardial',
		'stroke',
		'diabetes',
		'type 1 diabetes',
		'type 2 diabetes',
		'chronic kidney',
		'kidney failure',
		'asthma',
		'copd',
		'parkinson',
		'alzheimer',
		'epilepsy',
		'cancer',
	];
	const moderateRiskConditions = [
		'arthritis',
		'osteoporosis',
		'thyroid',
		'depression',
		'anxiety',
		'gerd',
		'reflux',
	];
	let riskScore = 0;
	const conditionLower = conditions.map((c) => c.toLowerCase());
	for (const condition of conditionLower) {
		if (highRiskConditions.some((hrc) => condition.includes(hrc))) riskScore += 15;
		else if (moderateRiskConditions.some((mrc) => condition.includes(mrc))) riskScore += 8;
		else riskScore += 5;
	}
	return Math.min(riskScore, 40);
}

function calculateMedicationRiskFromText(medsText) {
	const t = (medsText || '').toLowerCase();
	if (!t.trim()) return 0;
	const chunks = t.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
	let riskScore = 0;
	if (chunks.length > 5) riskScore += 10;
	else if (chunks.length > 3) riskScore += 5;
	else if (chunks.length > 0) riskScore += 2;
	const highRiskMedicationClasses =
		/anticoagulant|warfarin|insulin|immunosuppress|chemotherapy|antiarrhythmic/i;
	if (highRiskMedicationClasses.test(t)) riskScore += 8;
	return Math.min(riskScore, 25);
}

function calculateVitalsRisk(vitals) {
	if (!vitals || typeof vitals !== 'object') return 0;
	let riskScore = 0;
	const { systolic_bp, diastolic_bp, resting_heart_rate, bmi } = vitals;
	if (systolic_bp != null) {
		if (systolic_bp > 160) riskScore += 12;
		else if (systolic_bp > 140) riskScore += 8;
		else if (systolic_bp > 130) riskScore += 4;
	}
	if (diastolic_bp != null) {
		if (diastolic_bp > 100) riskScore += 10;
		else if (diastolic_bp > 90) riskScore += 6;
		else if (diastolic_bp > 80) riskScore += 2;
	}
	if (resting_heart_rate != null) {
		if (resting_heart_rate > 100) riskScore += 8;
		else if (resting_heart_rate > 90) riskScore += 4;
	}
	if (bmi != null) {
		if (bmi > 35) riskScore += 10;
		else if (bmi > 30) riskScore += 6;
		else if (bmi > 25) riskScore += 2;
	}
	return Math.min(riskScore, 30);
}

function calculateLifestyleRiskFromFacts(facts) {
	let riskScore = 0;
	const status = facts.smokingStatusQrisk ?? 0;
	if (status >= 4) riskScore += 15;
	else if (status === 3) riskScore += 12;
	else if (status === 2) riskScore += 8;
	else if (status === 1) riskScore += 5;

	const t = (facts.lifestyleText || '').toLowerCase();
	if (t.includes('sedentary') || t.includes('no exercise') || t.includes('none')) riskScore += 10;
	else if (t.includes('light')) riskScore += 5;
	if (t.includes('heavy alcohol') || t.includes('heavy drinking')) riskScore += 10;
	else if (t.includes('moderate alcohol')) riskScore += 3;
	if (t.includes('poor sleep')) riskScore += 8;
	else if (t.includes('fair sleep')) riskScore += 4;
	return Math.min(riskScore, 35);
}

function calculateFamilyHistoryRisk(fhFlag) {
	return fhFlag ? 12 : 0;
}

/**
 * @returns {{ index: number, components: Record<string, number> }}
 */
export function computeFallbackComposite(facts) {
	const age = facts.ageYears ?? 45;
	const ageRisk = calculateAgeRisk(age);
	const conditionRisk = calculateConditionRisk(facts.normalizedConditions || []);
	const medRisk = calculateMedicationRiskFromText(facts.medsText || '');
	const vitalsRisk = calculateVitalsRisk({
		systolic_bp: facts.systolicBp ?? undefined,
		diastolic_bp: facts.diastolicBp ?? undefined,
		resting_heart_rate: facts.restingHr ?? undefined,
		bmi: facts.bmi ?? undefined,
	});
	const lifestyleRisk = calculateLifestyleRiskFromFacts(facts);
	const fhRisk = calculateFamilyHistoryRisk(facts.familyHistoryCHDFLAG);

	const overall = Math.round(
		ageRisk * 0.15 +
			conditionRisk * 0.25 +
			medRisk * 0.15 +
			vitalsRisk * 0.2 +
			lifestyleRisk * 0.15 +
			fhRisk * 0.1
	);

	return {
		index: Math.min(100, Math.max(0, overall)),
		components: {
			ageRisk,
			conditionRisk,
			medRisk,
			vitalsRisk,
			lifestyleRisk,
			fhRisk,
		},
	};
}

/**
 * Chronic burden index 0–100 from conditions + family history keywords.
 */
export function computeChronicBurdenIndex(facts) {
	const conditions = facts.normalizedConditions || [];
	let score = 0;
	for (const c of conditions) {
		const cl = c.toLowerCase();
		if (
			/(cancer|diabetes|stroke|heart|coronary|kidney|copd|parkinson|epilepsy)/i.test(cl)
		) {
			score += 14;
		} else if (/(asthma|thyroid|depression|anxiety|arthritis)/i.test(cl)) {
			score += 8;
		} else {
			score += 5;
		}
	}
	if (facts.familyHistoryCHDFLAG) score += 10;
	return Math.min(100, score);
}
