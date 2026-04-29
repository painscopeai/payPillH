/**
 * Feature detection for migrating off PocketBase toward Supabase.
 * Components can branch on `isSupabaseConfigured()` while queries are ported incrementally.
 */
import { supabase } from '@/lib/supabaseClient.js';

export function isSupabaseConfigured() {
	return supabase !== null;
}
