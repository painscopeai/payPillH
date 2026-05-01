import rateLimit from 'express-rate-limit';
import { vercelSafeRateLimitKey } from './rate-limit-key.js';

export const integratedAiRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many AI requests, please try again later' },
	keyGenerator: (req) => vercelSafeRateLimitKey(req),
	validate: { trustProxy: false, xForwardedForHeader: false },
});