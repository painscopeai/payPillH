/**
 * Persist computed dashboard metrics for trend analysis (RULE snapshot).
 */

export async function fetchPreviousSnapshot(supabaseAdmin, userId) {
	const { data, error } = await supabaseAdmin
		.from('health_dashboard_metrics')
		.select('metrics, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function insertSnapshot(supabaseAdmin, userId, envelope) {
	const { error } = await supabaseAdmin.from('health_dashboard_metrics').insert({
		user_id: userId,
		metrics: envelope,
		updated_at: new Date().toISOString(),
	});
	if (error) throw error;
}

/** Avoid inserting on every dashboard poll — still compute metrics each request. */
export async function shouldInsertSnapshot(supabaseAdmin, userId, minHoursBetween = 6) {
	const prior = await fetchPreviousSnapshot(supabaseAdmin, userId);
	if (!prior?.created_at) return true;
	const hours = (Date.now() - new Date(prior.created_at).getTime()) / 3600000;
	return hours >= minHoursBetween;
}
