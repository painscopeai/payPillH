function parseNumber(val) {
	if (val === undefined || val === null || val === '') return null;
	const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

export function systolicFromMetrics(metrics) {
	if (!metrics || typeof metrics !== 'object') return null;
	const m = metrics;
	return parseNumber(m.systolic_bp ?? m.systolic ?? m.blood_pressure_systolic ?? m.sys ?? m.sbp);
}

export function diastolicFromMetrics(metrics) {
	if (!metrics || typeof metrics !== 'object') return null;
	const m = metrics;
	return parseNumber(m.diastolic_bp ?? m.diastolic ?? m.blood_pressure_diastolic ?? m.dia ?? m.dbp);
}
