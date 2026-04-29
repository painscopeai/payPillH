/**
 * Base URL for the Express API (same origin as the SPA on Vercel: `/api/...`).
 */
export function getApiBaseUrl() {
	return (
		import.meta.env.VITE_API_BASE_URL ??
		(import.meta.env.DEV ? '/hcgi/api' : '/api')
	);
}
