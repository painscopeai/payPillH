import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';
import { supabase } from '@/lib/supabaseClient.js';

const API_SERVER_URL = getApiBaseUrl();

/** Avoid indefinite hang when the tab wakes from sleep or the auth mutex is slow. */
const GET_SESSION_MS = 12_000;
const FETCH_DEADLINE_MS = 35_000;

async function authHeaders(extra = {}) {
	const headers = { ...extra };
	if (!supabase) return headers;
	try {
		const { data: { session } = { session: null } } = await Promise.race([
			supabase.auth.getSession(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('getSession timeout')), GET_SESSION_MS)
			),
		]);
		if (session?.access_token) {
			headers.Authorization = `Bearer ${session.access_token}`;
		}
	} catch (_) {
		/* Request may 401; HealthDashboard and callers show error or retry */
	}
	return headers;
}

const apiServerClient = {
	fetch: async (url, options = {}) => {
		const headers = await authHeaders(options.headers || {});
		const controller = new AbortController();
		const onDeadline = () => controller.abort();
		const deadline = setTimeout(onDeadline, FETCH_DEADLINE_MS);
		if (options.signal) {
			if (options.signal.aborted) controller.abort();
			else options.signal.addEventListener('abort', onDeadline, { once: true });
		}
		try {
			return await window.fetch(API_SERVER_URL + url, { ...options, headers, signal: controller.signal });
		} finally {
			clearTimeout(deadline);
		}
	},
};

export default apiServerClient;

export { apiServerClient };
