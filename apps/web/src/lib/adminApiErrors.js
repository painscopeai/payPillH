import { getApiBaseUrl } from '@/lib/apiBaseUrl.js';
import { API_FETCH_DEADLINE_MS } from '@/lib/apiFetchConstants.js';

/**
 * Reads JSON/text error body from a failed fetch Response (single read).
 */
export async function readApiErrorBody(response) {
	try {
		const text = await response.text();
		if (!text?.trim()) {
			return { detail: response.statusText || `Empty body (HTTP ${response.status})` };
		}
		try {
			const j = JSON.parse(text);
			const detail =
				(typeof j.error === 'string' && j.error) ||
				(typeof j.message === 'string' && j.message) ||
				text.slice(0, 1200);
			return { detail };
		} catch {
			return { detail: text.slice(0, 1200) };
		}
	} catch {
		return { detail: response.statusText || `HTTP ${response.status}` };
	}
}

/** Human-readable hint by status — helps locate Vercel vs auth vs timeout. */
export function httpStatusHint(status) {
	switch (status) {
		case 401:
			return 'Authentication: session expired or missing Bearer token. Sign in again; admin routes need profiles.role = admin.';
		case 403:
			return 'Authorization: not an admin user, or token rejected.';
		case 503:
			return 'API configuration: on the Vercel project that serves /api, set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_JWT_SECRET). Redeploy. Service role is required to read all rows (RLS).';
		case 504:
			return 'Gateway timeout: Vercel function exceeded its limit or upstream was slow. Set SUPABASE_JWT_SECRET for faster auth; check Vercel Runtime Logs.';
		default:
			return 'Use DevTools → Network → failed request → Headers + Response to inspect.';
	}
}

/**
 * Full multi-line message for admin UI + toasts.
 * @param {Response} response
 * @param {{ method?: string, path: string }} requestInfo path is like `/admin/summary` (appended to VITE API base)
 */
export async function formatAdminApiFailure(response, requestInfo) {
	const { method = 'GET', path } = requestInfo;
	const base = getApiBaseUrl().replace(/\/$/, '');
	const rel = path.startsWith('/') ? path : `/${path}`;
	const fullUrl = `${base}${rel}`;
	const { detail } = await readApiErrorBody(response);
	const status = response.status;
	const hint = httpStatusHint(status);
	return [
		`HTTP ${status} — ${detail}`,
		`Request: ${method} ${fullUrl}`,
		`Where to fix: ${hint}`,
	].join('\n');
}

/**
 * Message for thrown fetch errors (network / abort).
 */
export function formatAdminNetworkError(err, requestInfo) {
	const { method = 'GET', path } = requestInfo;
	const base = getApiBaseUrl().replace(/\/$/, '');
	const rel = path.startsWith('/') ? path : `/${path}`;
	const fullUrl = `${base}${rel}`;
	const name = err?.name || 'Error';
	if (name === 'AbortError') {
		const sec = Math.round(API_FETCH_DEADLINE_MS / 1000);
		return [
			`Request timed out or was aborted (browser cancelled the fetch after ~${sec}s; Vercel API max is often 60s).`,
			`Request: ${method} ${fullUrl}`,
			'Where to fix: confirm latest deploy (rate-limit fix), set SUPABASE_JWT_SECRET on the API project, then check Vercel Runtime Logs for the same timestamp.',
		].join('\n');
	}
	return [err?.message || String(err), `Request: ${method} ${fullUrl}`].join('\n');
}
