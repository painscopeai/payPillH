import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Returns `patients.id` for this auth user, creating a row if missing.
 */
export async function ensurePatientForUser(userId) {
	if (!supabaseAdmin) {
		throw new Error('Database unavailable');
	}
	const { data: existing } = await supabaseAdmin.from('patients').select('id').eq('user_id', userId).maybeSingle();
	if (existing?.id) return existing.id;
	const { data: created, error } = await supabaseAdmin.from('patients').insert({ user_id: userId }).select('id').single();
	if (error) throw error;
	return created.id;
}
