import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';
import { supabase } from '@/lib/supabaseClient.js';
import { sleepRace } from '@/lib/sleepRace.js';

const API_SERVER_URL = getApiBaseUrl();

/** Every Supabase auth call must be bounded — unbounded `getSession()` caused endless admin UI loading. */
const GET_SESSION_MS = 12_000;
const GET_SESSION_RETRY_MS = 8_000;
const REFRESH_SESSION_MS = 12_000;
const FETCH_DEADLINE_MS = 45_000;

/**
 * Resolves Authorization for API calls. Never intentionally omits the token when a session exists:
 * uses refreshSession when access_token is missing. All auth I/O is time-bounded.
 */
async function authHeaders(extra = {}) {
	const headers = { ...extra };
	if (headers.Authorization) return headers;
	if (!supabase) return headers;

	let session = null;
	try {
		const first = await sleepRace(supabase.auth.getSession(), GET_SESSION_MS);
		session = first?.data?.session ?? null;
	} catch {
		try {
			const retry = await sleepRace(supabase.auth.getSession(), GET_SESSION_RETRY_MS);
			session = retry?.data?.session ?? null;
		} catch {
			session = null;
		}
	}

	if (!session?.access_token) {
		try {
			await sleepRace(supabase.auth.refreshSession(), REFRESH_SESSION_MS);
			const after = await sleepRace(supabase.auth.getSession(), GET_SESSION_RETRY_MS);
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
	/**
	 * @param {string} url path after API base (e.g. `/admin/summary`)
	 * @param {RequestInit & { signal?: AbortSignal }} [options]
	 */
	fetch: async (url, options = {}) => {
		const headers = await authHeaders(options.headers || {});
		const parentSignal = options.signal;
		const controller = new AbortController();
		const deadline = setTimeout(() => controller.abort(), FETCH_DEADLINE_MS);
		const onParentAbort = () => controller.abort();
		if (parentSignal) {
			if (parentSignal.aborted) controller.abort();
			else parentSignal.addEventListener('abort', onParentAbort);
		}
		const { signal: _ignored, ...restOptions } = options;
		try {
			return await window.fetch(API_SERVER_URL + url, {
				...restOptions,
				headers,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(deadline);
			if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
		}
	},
};

export default apiServerClient;

export { apiServerClient };
