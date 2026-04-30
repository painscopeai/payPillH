import { getBrowserSupabase } from '@/lib/supabaseClient.js';

/**
 * Resolves public.patients.id for the signed-in user, creating a row if allowed by RLS.
 */
export async function ensurePatientRowId(userId) {
	const sb = getBrowserSupabase();
	const { data: existing } = await sb.from('patients').select('id').eq('user_id', userId).maybeSingle();
	if (existing?.id) return existing.id;
	const { data: created, error } = await sb.from('patients').insert({ user_id: userId }).select('id').single();
	if (error) throw error;
	return created.id;
}
