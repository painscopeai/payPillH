/**
 * Condition names from patient_medical_conditions (Health Records) for inference merge.
 */
export async function fetchConditionPhrasesFromHealthRecords(supabaseAdmin, userId) {
	if (!supabaseAdmin || !userId) return [];

	const { data: patientRow, error: pErr } = await supabaseAdmin
		.from('patients')
		.select('id')
		.eq('user_id', userId)
		.maybeSingle();
	if (pErr || !patientRow?.id) return [];

	const { data: rows, error: rErr } = await supabaseAdmin
		.from('patient_medical_conditions')
		.select('payload')
		.eq('patient_id', patientRow.id);
	if (rErr || !rows?.length) return [];

	const names = [];
	for (const r of rows) {
		const n = r.payload && typeof r.payload === 'object' ? r.payload.name : null;
		if (typeof n === 'string' && n.trim()) names.push(n.trim());
	}
	return names;
}
