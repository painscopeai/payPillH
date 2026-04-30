import rateLimit from 'express-rate-limit';

export const globalRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	// Vercel sets X-Forwarded-* / Forwarded; must align with app.set('trust proxy', true)
	validate: { trustProxy: true },
});