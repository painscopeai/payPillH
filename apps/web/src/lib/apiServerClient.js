import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';
import { supabase } from '@/lib/supabaseClient.js';

const API_SERVER_URL = getApiBaseUrl();

async function authHeaders(extra = {}) {
	const headers = { ...extra };
	try {
		if (supabase) {
			const { data: { session } } = await supabase.auth.getSession();
			if (session?.access_token) {
				headers.Authorization = `Bearer ${session.access_token}`;
			}
		}
	} catch (_) {
		/* ignore */
	}
	return headers;
}

const apiServerClient = {
	fetch: async (url, options = {}) => {
		const headers = await authHeaders(options.headers || {});
		return await window.fetch(API_SERVER_URL + url, { ...options, headers });
	},
};

export default apiServerClient;

export { apiServerClient };
