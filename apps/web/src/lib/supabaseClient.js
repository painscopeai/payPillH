import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client (anon key). Safe for RLS-protected reads/writes.
 * Returns null when env is not configured (app still uses PocketBase until migration is complete).
 */
export function createSupabaseBrowserClient() {
	const url = import.meta.env.VITE_SUPABASE_URL;
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		return null;
	}
	return createClient(url, anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	});
}

export const supabase = createSupabaseBrowserClient();
