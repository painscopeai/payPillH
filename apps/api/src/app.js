import { loadLocalEnv } from './lib/loadEnv.js';

loadLocalEnv();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

const app = express();

app.set('trust proxy', true);

// Vercel mounts this serverless handler under `/api/*`. Express routers use `/health`, `/auth`, …
app.use((req, res, next) => {
	const u = typeof req.url === 'string' ? req.url : '';
	if (!u.startsWith('/api')) {
		next();
		return;
	}
	const tail = u.slice(4);
	req.url = tail === '' || tail.startsWith('?') ? `/${tail}` : tail;
	next();
});

function resolveCorsOrigin() {
	const explicit = process.env.CORS_ORIGIN?.trim();
	if (explicit) {
		const parts = explicit.split(',').map((s) => s.trim()).filter(Boolean);
		return parts.length === 1 ? parts[0] : parts;
	}
	// First deploys: no manual URL yet — Vercel sets VERCEL_URL (host only, no scheme).
	if (process.env.VERCEL === '1' && process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}
	// Local dev: reflect request Origin (any localhost port).
	return true;
}

app.use(helmet());
app.use(cors({
	origin: resolveCorsOrigin(),
	credentials: true,
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({
	extended: true,
	limit: BodyLimit,
}));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

export default app;
export { app };
