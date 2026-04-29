import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import logger from './logger.js';

dotenv.config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

/** Server-side Supabase (service role) for trusted API work. */
export const supabaseAdmin = url && serviceKey
	? createClient(url, serviceKey, { auth: { persistSession: false } })
	: url && anonKey
		? createClient(url, anonKey, { auth: { persistSession: false } })
		: null;

if (!supabaseAdmin) {
	logger.warn('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON) not set — data routes may fail.');
}

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
		create: async (data) => ({ id: 'stub', ...data }),
		update: async (id, data) => ({ id, ...data }),
		delete: async () => true,
		subscribe: () => noopUnsub,
	};
}

/** @deprecated Legacy PocketBase shape — returns empty data; prefer supabaseAdmin. */
const pocketbaseClient = {
	collection: () => emptyCollection(),
	authStore: { isValid: false, model: null, token: null, clear() {}, save() {} },
};

export default pocketbaseClient;
export { pocketbaseClient };
