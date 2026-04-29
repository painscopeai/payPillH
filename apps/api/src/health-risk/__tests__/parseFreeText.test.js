import test from 'node:test';
import assert from 'node:assert/strict';
import {
	parseCommaList,
	normalizeConditionPhrases,
	hasSecondaryCvd,
	inferDiabetesStatus,
	inferSmokingStatus,
	familyHistoryCoronaryText,
} from '../parseFreeText.js';

test('parseCommaList splits and trims', () => {
	const r = parseCommaList(' Hypertension , Type 2 Diabetes ; Asthma ');
	assert.deepEqual(r, ['Hypertension', 'Type 2 Diabetes', 'Asthma']);
});

test('normalizeConditionPhrases maps HTN and T2DM', () => {
	const { normalized } = normalizeConditionPhrases(['HTN', 'T2DM']);
	assert.ok(normalized.some((s) => s.includes('hypertension')));
	assert.ok(normalized.some((s) => s.includes('diabetes')));
});

test('hasSecondaryCvd detects prior MI wording', () => {
	assert.equal(hasSecondaryCvd(['myocardial infarction']), true);
	assert.equal(hasSecondaryCvd(['hay fever']), false);
});

test('inferDiabetesStatus', () => {
	const d = inferDiabetesStatus(['type 2 diabetes'], '');
	assert.equal(d.type2, true);
	assert.equal(d.type1, false);
});

test('inferSmokingStatus from lifestyle text', () => {
	assert.equal(inferSmokingStatus('never smoked').status, 0);
	assert.equal(inferSmokingStatus('former smoker').status, 1);
	assert.ok([2, 3, 4].includes(inferSmokingStatus('smoking 10 cigarettes daily').status));
});

test('familyHistoryCoronaryText', () => {
	assert.equal(familyHistoryCoronaryText('Father had heart attack at 55'), true);
	assert.equal(familyHistoryCoronaryText('No family issues'), false);
});
