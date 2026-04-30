import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';
import { supabase } from '@/lib/supabaseClient.js';

const API_SERVER_URL = getApiBaseUrl();

const GET_SESSION_SOFT_MS = 28_000;
const FETCH_DEADLINE_MS = 35_000;

function sleepRace(promise, ms) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error('getSession soft timeout')), ms)),
	]);
}

/**
 * Resolves Authorization for API calls. Never intentionally omits the token when a session exists:
 * uses refreshSession when access_token is missing, and retries after soft timeout once.
 */
async function authHeaders(extra = {}) {
	const headers = { ...extra };
	if (headers.Authorization) return headers;
	if (!supabase) return headers;

	let session = null;
	try {
		const first = await sleepRace(supabase.auth.getSession(), GET_SESSION_SOFT_MS);
		session = first?.data?.session ?? null;
	} catch {
		try {
			const retry = await supabase.auth.getSession();
			session = retry?.data?.session ?? null;
		} catch {
			session = null;
		}
	}

	if (!session?.access_token) {
		try {
			await supabase.auth.refreshSession();
			const after = await supabase.auth.getSession();
			session = after?.data?.session ?? null;
		} catch {
			/* signed out or refresh failed */
		}
	}

	if (session?.access_token) {
		headers.Authorization = `Bearer ${session.access_token}`;
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
