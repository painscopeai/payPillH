import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVitalsSeries } from '../vitalsSeries.js';

test('buildVitalsSeries maps vitals rows to chart points', () => {
	const facts = {
		vitalsRowsChronological: [
			{ metrics: { systolic_bp: 118 }, measured_at: '2026-04-01T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
			{ metrics: { blood_pressure_systolic: 122 }, measured_at: '2026-04-02T10:00:00Z', created_at: '2026-04-02T10:00:00Z' },
		],
		systolicBp: null,
	};
	const s = buildVitalsSeries(facts);
	assert.equal(s.length, 2);
	assert.equal(s[1].value, 122);
});

test('buildVitalsSeries falls back to onboarding systolic', () => {
	const facts = {
		vitalsRowsChronological: [],
		systolicBp: 127,
	};
	const s = buildVitalsSeries(facts);
	assert.equal(s.length, 1);
	assert.equal(s[0].value, 127);
});
