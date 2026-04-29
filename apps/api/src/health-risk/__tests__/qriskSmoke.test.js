import test from 'node:test';
import assert from 'node:assert/strict';
import { runQrisk3 } from '../qriskRunner.js';

/**
 * Smoke test: QRISK3 library returns a finite percentage for a minimal valid primary-prevention profile.
 * Regression against qrisk.org should be done manually per ClinRisk guidance.
 */
test('runQrisk3 returns bounded percent for typical male 45', () => {
	const imputed = [];
	const facts = {
		ageYears: 45,
		sexAtBirth: 'male',
		bmi: 26,
		systolicBp: 128,
		diastolicBp: 82,
		normalizedConditions: [],
		medsText: '',
		diabetesType1: false,
		diabetesType2: false,
		treatedHypertension: false,
		secondaryCvdLikely: false,
		smokingStatusQrisk: 0,
		familyHistoryCHDFLAG: false,
		lifestyleText: '',
	};
	const out = runQrisk3(facts, imputed);
	assert.ok(out.percent != null, `expected percent, got ${JSON.stringify(out)}`);
	assert.ok(out.percent >= 0 && out.percent <= 100, `percent out of range: ${out.percent}`);
});

