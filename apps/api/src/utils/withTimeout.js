/**
 * Rejects if `promise` does not settle within `ms` (avoids Vercel 60s serverless kills).
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = 'operation') {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => {
				const err = new Error(`${label} timed out after ${ms}ms`);
				err.code = 'ETIMEOUT';
				reject(err);
			}, ms)
		),
	]);
}
