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

/**
 * Allow only same-app relative paths (no protocol / open redirects).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function sanitizeInternalPath(raw) {
	if (typeof raw !== 'string') return null;
	const t = raw.trim();
	if (!t.startsWith('/') || t.startsWith('//') || t.includes('://')) return null;
	const noHash = t.split('#')[0];
	return noHash || '/';
}

/** Post-login / post-verify navigation */
export function getDefaultRouteForUser(user) {
	if (!user?.role) return '/';
	if (user.role === 'admin') return '/admin/dashboard';
	if (user.role === 'provider') return '/provider/dashboard';
	if (user.role === 'individual') {
		return user.onboarding_completed ? '/patient/dashboard' : '/patient/onboarding';
	}
	if (user.role === 'employer') return '/employer/dashboard';
	if (user.role === 'insurance') return '/insurance/dashboard';
	return '/';
}
