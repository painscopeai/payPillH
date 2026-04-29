import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client (anon key). RLS applies.
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

/** Throws if env is missing — auth/onboarding require Supabase. */
export function getBrowserSupabase() {
	if (!supabase) {
		throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
	}
	return supabase;
}
