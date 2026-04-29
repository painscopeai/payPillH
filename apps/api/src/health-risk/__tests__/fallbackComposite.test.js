import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFallbackComposite, computeChronicBurdenIndex } from '../fallbackComposite.js';

test('fallback composite returns bounded index', () => {
	const r = computeFallbackComposite({
		ageYears: 55,
		normalizedConditions: ['hypertension'],
		medsText: 'lisinopril',
		systolicBp: 135,
		diastolicBp: 85,
		bmi: 27,
		smokingStatusQrisk: 0,
		lifestyleText: '',
		familyHistoryCHDFLAG: false,
	});
	assert.ok(r.index >= 0 && r.index <= 100);
});

test('chronic burden increases with conditions', () => {
	const low = computeChronicBurdenIndex({ normalizedConditions: [], familyHistoryCHDFLAG: false });
	const high = computeChronicBurdenIndex({
		normalizedConditions: ['type 2 diabetes', 'hypertension'],
		familyHistoryCHDFLAG: true,
	});
	assert.ok(high >= low);
});
