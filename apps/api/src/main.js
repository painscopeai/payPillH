import logger from './utils/logger.js';
import app from './app.js';

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');

	await new Promise(resolve => setTimeout(resolve, 3000));

	logger.info('Exiting');
	process.exit();
});

const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
	const port = process.env.PORT || 3001;
	app.listen(port, () => {
		logger.info(`API Server running on http://localhost:${port}`);
	});
}

export default app;
