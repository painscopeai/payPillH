/**
 * Vercel/serverless often omits `req.ip` even with `trust proxy`, which makes
 * express-rate-limit v8 throw ERR_ERL_UNDEFINED_IP_ADDRESS and hang until the
 * function times out. Prefer proxy headers, then fall back.
 */
export function vercelSafeRateLimitKey(req) {
	const xf = req.headers['x-forwarded-for'];
	if (typeof xf === 'string' && xf.length) {
		return xf.split(',')[0].trim().slice(0, 128) || 'unknown';
	}
	const real = req.headers['x-real-ip'];
	if (typeof real === 'string' && real.length) {
		return real.trim().slice(0, 128);
	}
	if (typeof req.ip === 'string' && req.ip.length) {
		return req.ip;
	}
	return 'unknown';
}
