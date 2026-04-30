/**
 * Aggregate rows into `{ month: 'YYYY-MM', count, value }` buckets for charts.
 */
export function twelveMonthTrend(rows, dateField = 'created_at') {
	const trends = [];
	const now = new Date();
	for (let i = 11; i >= 0; i--) {
		const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
		const count = (rows || []).filter((r) => {
			const d = new Date(r[dateField]);
			return !Number.isNaN(d.getTime()) && d >= monthStart && d <= monthEnd;
		}).length;
		const key = monthStart.toISOString().slice(0, 7);
		trends.push({ month: key, count, value: count });
	}
	return trends;
}

export function pct(numerator, denominator) {
	if (!denominator) return 0;
	return parseFloat(((numerator / denominator) * 100).toFixed(2));
}
