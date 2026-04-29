import { systolicFromMetrics } from './vitalsExtract.js';

export function buildVitalsSeries(facts) {
	const rows = facts.vitalsRowsChronological || [];
	const series = [];

	for (const row of rows.slice(-14)) {
		const sys = systolicFromMetrics(row.metrics);
		if (sys == null || !Number.isFinite(Number(sys))) continue;
		const d = row.measured_at || row.created_at;
		const date = d ? new Date(d) : null;
		series.push({
			name:
				date?.toLocaleDateString('en-GB', { weekday: 'short' }) ??
				'',
			value: Math.round(Number(sys)),
			measuredAt: d || null,
		});
	}

	if (series.length === 0 && facts.systolicBp != null && Number.isFinite(facts.systolicBp)) {
		series.push({
			name: 'Recorded',
			value: Math.round(facts.systolicBp),
			measuredAt: null,
		});
	}

	return series;
}
