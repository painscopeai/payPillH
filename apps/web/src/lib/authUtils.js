import { getBrowserSupabase } from '@/lib/supabaseClient.js';

/**
 * Ensure a public.patients row exists for this auth user (individual flow).
 * @returns {Promise<string>} patient id uuid
 */
export async function ensurePatientRecord(userId) {
	const sb = getBrowserSupabase();
	const { data: existing } = await sb.from('patients').select('id').eq('user_id', userId).maybeSingle();
	if (existing?.id) return existing.id;
	const { data: created, error } = await sb.from('patients').insert({ user_id: userId }).select('id').single();
	if (error) throw error;
	return created.id;
}

export function yearsBetweenDates(fromIsoDate, toDate = new Date()) {
	const birth = new Date(fromIsoDate);
	if (Number.isNaN(birth.getTime())) return 0;
	let age = toDate.getFullYear() - birth.getFullYear();
	const m = toDate.getMonth() - birth.getMonth();
	if (m < 0 || (m === 0 && toDate.getDate() < birth.getDate())) age--;
	return age;
}

export function isAtLeastAge(isoDateString, minYears = 18) {
	return yearsBetweenDates(isoDateString) >= minYears;
}

/** Post-login / post-verify navigation */
export function getDefaultRouteForUser(user) {
	if (!user?.role) return '/';
	if (user.role === 'individual') {
		return user.onboarding_completed ? '/patient/dashboard' : '/patient/onboarding';
	}
	if (user.role === 'employer') return '/employer/dashboard';
	if (user.role === 'insurance') return '/insurance/dashboard';
	return '/';
}
