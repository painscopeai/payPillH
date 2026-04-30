import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Resolve notification emails for patient + provider rows.
 */
export async function resolveBookingEmails(userId, providerId) {
	if (!supabaseAdmin) {
		return {
			patientEmail: null,
			providerEmail: null,
			patientLabel: 'Patient',
			providerDisplay: null,
		};
	}

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('email, first_name, last_name')
		.eq('id', userId)
		.maybeSingle();

	const { data: provider } = await supabaseAdmin
		.from('providers')
		.select('user_id, email, display_name')
		.eq('id', providerId)
		.maybeSingle();

	let providerEmail = provider?.email ?? null;
	if (!providerEmail && provider?.user_id) {
		const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', provider.user_id).maybeSingle();
		providerEmail = prof?.email ?? null;
	}

	const patientLabel =
		[profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || 'Patient';

	return {
		patientEmail: profile?.email ?? null,
		providerEmail,
		patientLabel,
		providerDisplay: provider?.display_name ?? null,
	};
}
