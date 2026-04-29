/**
 * Legacy compatibility shim — PocketBase was removed. Collection calls return safe
 * empty data; new code should use Supabase (see @/lib/supabaseClient.js).
 */
const noopUnsub = () => {};

function emptyCollection() {
	return {
		getFullList: async () => [],
		getList: async () => ({ totalItems: 0, items: [] }),
		getFirstListItem: async () => {
			const e = new Error('Record not found');
			e.status = 404;
			throw e;
		},
		getOne: async () => {
			const e = new Error('Record not found');
			e.status = 404;
			throw e;
		},
		create: async (data) => ({ id: 'local-stub', ...data }),
		update: async (id, data) => ({ id, ...data }),
		delete: async () => true,
		subscribe: () => noopUnsub,
	};
}

const pocketbaseClient = {
	collection: () => emptyCollection(),
	authStore: {
		isValid: false,
		model: null,
		token: null,
		clear() {},
		save() {},
	},
};

export default pocketbaseClient;
export { pocketbaseClient };
