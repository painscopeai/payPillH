import { createRequire } from 'module';

let cached;

function loadQrisk() {
	if (cached) return cached;
	const require = createRequire(import.meta.url);
	cached = require('sisuwellness-qrisk3');
	return cached;
}

/**
 * Run QRISK3-2017 via sisuwellness-qrisk3.
 * @returns {{ percent: number|null, error?: string, qriskInput?: object }}
 */
export function runQrisk3(facts, imputedFields) {
	const impute = (name, value, reason) => {
		imputedFields.push({ field: name, value, reason });
	};

	try {
		const { calculateScore, inputBuilder, Disclaimer } = loadQrisk();
		const { Sex, Ethnicity, SmokingStatus, DiabetesStatus } = inputBuilder;

		const age = facts.ageYears;
		const sex = facts.sexAtBirth === 'male' ? Sex.male : Sex.female;

		if (facts.sexAtBirth !== 'male' && facts.sexAtBirth !== 'female') {
			return { percent: null, error: 'sex_not_binary_mapped', Disclaimer };
		}
		if (age == null || age < 25 || age > 84) {
			return { percent: null, error: 'age_out_of_qrisk_range', Disclaimer };
		}

		let bmi = facts.bmi;
		if (bmi == null || !Number.isFinite(bmi)) {
			bmi = 25;
			impute('bmi', bmi, 'default_population_mean_placeholder');
		}

		let systolic = facts.systolicBp;
		if (systolic == null || !Number.isFinite(systolic)) {
			systolic = 120;
			impute('systolicBloodPressure', systolic, 'missing_bp_placeholder');
		}

		let ratio = 4.0;
		impute('cholesterolHdlRatio', ratio, 'missing_lipids_ratio_placeholder');

		let sd = 5;
		impute('systolicStandardDeviation', sd, 'missing_bp_variability_placeholder');

		let townsend = 0;
		impute('townsendScore', townsend, 'missing_deprivation_default');

		const ethKey = Ethnicity.white;
		const aboutYou = inputBuilder.buildAboutYou(age, sex, ethKey);

		const dm = DiabetesStatus.none;
		let diabetesStatus = dm;
		if (facts.diabetesType1) diabetesStatus = DiabetesStatus.type1;
		else if (facts.diabetesType2) diabetesStatus = DiabetesStatus.type2;

		const smokingStatus =
			[
				SmokingStatus.nonSmoker,
				SmokingStatus.formerSmoker,
				SmokingStatus.lightSmoker,
				SmokingStatus.moderateSmoker,
				SmokingStatus.heavySmoker,
			][facts.smokingStatusQrisk] ?? SmokingStatus.nonSmoker;

		const clinical = inputBuilder.buildClinical(
			smokingStatus,
			diabetesStatus,
			!!facts.familyHistoryCHDFLAG,
			/(ckd|chronic kidney|kidney disease stage)/i.test((facts.normalizedConditions || []).join(' ')),
			/\b(af|atrial fibrillation|afib)\b/i.test((facts.normalizedConditions || []).join(' ')),
			!!facts.treatedHypertension,
			/\bmigraine\b/i.test((facts.normalizedConditions || []).join(' ')),
			/\brheumatoid\b/i.test((facts.normalizedConditions || []).join(' ')),
			/\blupus\b|sle\b/i.test((facts.normalizedConditions || []).join(' ')),
			/\b(schizophrenia|bipolar|psychosis|severe mental)\b/i.test(
				(facts.normalizedConditions || []).join(' ')
			),
			false,
			false
		);

		const biometric = inputBuilder.buildBiometrics(ratio, systolic, sd, bmi);
		const qriskInput = inputBuilder.buildQriskInput(aboutYou, clinical, biometric, townsend);

		const raw = calculateScore(qriskInput);
		const percent =
			Number.isFinite(raw) && raw >= 0 && raw <= 100.1
				? Math.round(Math.min(100, raw) * 10) / 10
				: null;
		if (percent == null) {
			return { percent: null, error: 'qrisk_invalid_result', qriskInput, Disclaimer };
		}
		return { percent, qriskInput, Disclaimer };
	} catch (e) {
		return { percent: null, error: e?.message || 'qrisk_exception' };
	}
}

export function getClinRiskDisclaimer() {
	try {
		return loadQrisk().Disclaimer || '';
	} catch {
		return '';
	}
}
