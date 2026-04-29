import PocketBase, { ClientResponseError, LocalAuthStore } from 'pocketbase';

class DevAuthStore extends LocalAuthStore {
	get isValid() {
		return !!(this.token && this.record);
	}
}

function splitPath(path) {
	return path.split('?')[0];
}

/**
 * In-memory PocketBase-shaped client for DEV_MOCKS (Express routes that still import pb).
 */
export function createDevMockServerPb() {
	const memory = new Map();
	let idCounter = 0;
	const nextId = (collection) => `${collection}_${++idCounter}_${Date.now()}`;

	const MOCK_USER_RECORD = {
		id: 'dev_mock_user_001',
		email: 'dev@example.com',
		role: 'individual',
		collectionId: 'pbc_users_mock',
		collectionName: 'users',
		verified: true,
		first_name: 'Dev',
		last_name: 'User',
		emailVisibility: true,
	};

	const client = new PocketBase('http://127.0.0.1:8090', new DevAuthStore());
	client.autoCancellation(false);

	client.send = async function devSend(path, options) {
		const pathOnly = splitPath(path);
		const method = (options?.method || 'GET').toUpperCase();
		let body = options?.body;
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body);
			} catch {
				/* ignore */
			}
		}

		if (pathOnly === '/api/health') {
			return { message: 'API is healthy.', code: 200 };
		}

		const authPwd = pathOnly.match(/^\/api\/collections\/([^/]+)\/auth-with-password$/);
		if (authPwd && method === 'POST') {
			const collection = authPwd[1];
			if (collection === '_superusers') {
				return {
					token: 'dev_superusers_token',
					admin: { id: 'dev_super_admin', collectionName: '_superusers' },
				};
			}
			if (collection === 'users') {
				const identity = body?.identity || body?.email;
				let record = [...memory.entries()].find(([k, v]) => k.startsWith('users:') && v.email === identity)?.[1];
				if (!record && identity === MOCK_USER_RECORD.email) {
					record = { ...MOCK_USER_RECORD };
				}
				if (!record) {
					throw new ClientResponseError({
						status: 400,
						response: { message: 'Failed to authenticate.', data: {} },
					});
				}
				const rec = { ...record, collectionName: 'users', collectionId: record.collectionId || 'pbc_users_mock' };
				client.authStore.save(`dev_jwt.${identity}`, rec);
				return { token: client.authStore.token, record: rec };
			}
		}

		const authRefresh = pathOnly.match(/^\/api\/collections\/([^/]+)\/auth-refresh$/);
		if (authRefresh && method === 'POST') {
			const record = client.authStore.record;
			if (!record) {
				throw new ClientResponseError({ status: 401, response: { message: 'Not authenticated.' } });
			}
			return { token: client.authStore.token, record };
		}

		const recMatch = pathOnly.match(/^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/);
		if (recMatch) {
			const [, collection, recordId] = recMatch;

			if (!recordId) {
				if (method === 'GET') {
					return {
						page: 1,
						perPage: 30,
						totalItems: 0,
						totalPages: 0,
						items: [],
					};
				}
				if (method === 'POST') {
					const id = nextId(collection);
					const rec = {
						...body,
						id,
						collectionId: collection,
						collectionName: collection,
					};
					memory.set(`${collection}:${id}`, rec);
					return rec;
				}
			}

			if (method === 'GET') {
				if (collection === 'users' && recordId === MOCK_USER_RECORD.id) {
					return { ...MOCK_USER_RECORD };
				}
				const stored = memory.get(`${collection}:${recordId}`);
				if (stored) {
					return stored;
				}
				throw new ClientResponseError({
					status: 404,
					response: { code: 404, message: "The requested resource wasn't found.", data: {} },
				});
			}

			if (method === 'PATCH') {
				let prev =
					memory.get(`${collection}:${recordId}`) ||
					(collection === 'users' && recordId === MOCK_USER_RECORD.id ? { ...MOCK_USER_RECORD } : null);
				if (!prev) {
					throw new ClientResponseError({
						status: 404,
						response: { code: 404, message: "The requested resource wasn't found.", data: {} },
					});
				}
				const merged = { ...prev, ...body, id: recordId };
				memory.set(`${collection}:${recordId}`, merged);
				if (collection === 'users' && client.authStore.record?.id === recordId) {
					client.authStore.save(client.authStore.token, merged);
				}
				return merged;
			}

			if (method === 'DELETE') {
				memory.delete(`${collection}:${recordId}`);
				return true;
			}
		}

		console.warn('[devPocketBaseServerMock] unhandled request:', method, pathOnly);
		throw new ClientResponseError({
			status: 501,
			response: { message: `Dev mock: add a handler for ${pathOnly}` },
		});
	};

	client.authStore.save('dev_superusers_token', {
		id: 'dev_super_admin',
		collectionName: '_superusers',
	});

	return client;
}
