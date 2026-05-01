import rateLimit from 'express-rate-limit';
import { vercelSafeRateLimitKey } from './rate-limit-key.js';

export const globalRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	keyGenerator: (req) => vercelSafeRateLimitKey(req),
	// Rely on explicit X-Forwarded-For / x-real-ip via keyGenerator — avoids ERR_ERL_UNDEFINED_IP_ADDRESS on Vercel.
	validate: { trustProxy: false, xForwardedForHeader: false },
});