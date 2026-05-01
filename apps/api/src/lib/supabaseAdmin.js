import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

dotenv.config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

/** True when using the service role key — required for admin aggregates (anon is subject to RLS). */
export const hasServiceRoleKey = Boolean(url && serviceKey);

/** Server-side Supabase client (service role preferred). Bypasses RLS for trusted API operations. */
export const supabaseAdmin =
	url && serviceKey
		? createClient(url, serviceKey, { auth: { persistSession: false } })
		: url && anonKey
			? createClient(url, anonKey, { auth: { persistSession: false } })
			: null;

if (!supabaseAdmin) {
	logger.warn('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON) not set — API data routes may fail.');
} else if (!serviceKey) {
	logger.warn(
		'[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing — using anon key. Admin dashboards will show zeros / incomplete data because Row Level Security hides other users rows.'
	);
}
