import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { ensurePatientRecord } from '@/lib/authUtils.js';

/**
 * @typedef {Object} HealthRecordRow
 * @property {string} id
 * @property {string} patient_id
 * @property {Record<string, unknown>} payload
 * @property {string} created_at
 */

async function fetchAllForPatient(pid, setters) {
	const sb = getBrowserSupabase();
	const [c, l, a, s] = await Promise.all([
		sb.from('patient_medical_conditions').select('*').eq('patient_id', pid).order('created_at', { ascending: false }),
		sb.from('patient_lab_history').select('*').eq('patient_id', pid).order('created_at', { ascending: false }),
		sb.from('patient_allergies').select('*').eq('patient_id', pid).order('created_at', { ascending: false }),
		sb.from('patient_medical_history').select('*').eq('patient_id', pid).order('created_at', { ascending: false }),
	]);
	if (c.error) throw c.error;
	if (l.error) throw l.error;
	if (a.error) throw a.error;
	if (s.error) throw s.error;
	setters.setConditions(c.data || []);
	setters.setLabs(l.data || []);
	setters.setAllergies(a.data || []);
	setters.setSurgeries(s.data || []);
}

export function usePatientHealthRecords(userId) {
	const [patientId, setPatientId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [conditions, setConditions] = useState(/** @type {HealthRecordRow[]} */ ([]));
	const [labs, setLabs] = useState(/** @type {HealthRecordRow[]} */ ([]));
	const [allergies, setAllergies] = useState(/** @type {HealthRecordRow[]} */ ([]));
	const [surgeries, setSurgeries] = useState(/** @type {HealthRecordRow[]} */ ([]));

	const setters = { setConditions, setLabs, setAllergies, setSurgeries };

	const reload = useCallback(async () => {
		if (!patientId) return;
		setError(null);
		await fetchAllForPatient(patientId, setters);
	}, [patientId]);

	useEffect(() => {
		if (!userId) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const pid = await ensurePatientRecord(userId);
				if (cancelled) return;
				setPatientId(pid);
				await fetchAllForPatient(pid, setters);
			} catch (e) {
				if (!cancelled) setError(e.message || 'Could not load health records');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
	}, [userId]);

	const insertCondition = async (payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb
			.from('patient_medical_conditions')
			.insert({ patient_id: patientId, payload })
			.select('*')
			.single();
		if (err) throw err;
		setConditions((prev) => [data, ...prev]);
		return data;
	};

	const updateCondition = async (id, payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_medical_conditions').update({ payload }).eq('id', id).select('*').single();
		if (err) throw err;
		setConditions((prev) => prev.map((r) => (r.id === id ? data : r)));
		return data;
	};

	const deleteCondition = async (id) => {
		const sb = getBrowserSupabase();
		const { error: err } = await sb.from('patient_medical_conditions').delete().eq('id', id);
		if (err) throw err;
		setConditions((prev) => prev.filter((r) => r.id !== id));
	};

	const insertLab = async (payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_lab_history').insert({ patient_id: patientId, payload }).select('*').single();
		if (err) throw err;
		setLabs((prev) => [data, ...prev]);
		return data;
	};

	const updateLab = async (id, payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_lab_history').update({ payload }).eq('id', id).select('*').single();
		if (err) throw err;
		setLabs((prev) => prev.map((r) => (r.id === id ? data : r)));
		return data;
	};

	const deleteLab = async (id) => {
		const sb = getBrowserSupabase();
		const { error: err } = await sb.from('patient_lab_history').delete().eq('id', id);
		if (err) throw err;
		setLabs((prev) => prev.filter((r) => r.id !== id));
	};

	const insertAllergy = async (payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_allergies').insert({ patient_id: patientId, payload }).select('*').single();
		if (err) throw err;
		setAllergies((prev) => [data, ...prev]);
		return data;
	};

	const updateAllergy = async (id, payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_allergies').update({ payload }).eq('id', id).select('*').single();
		if (err) throw err;
		setAllergies((prev) => prev.map((r) => (r.id === id ? data : r)));
		return data;
	};

	const deleteAllergy = async (id) => {
		const sb = getBrowserSupabase();
		const { error: err } = await sb.from('patient_allergies').delete().eq('id', id);
		if (err) throw err;
		setAllergies((prev) => prev.filter((r) => r.id !== id));
	};

	const insertSurgery = async (payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb
			.from('patient_medical_history')
			.insert({ patient_id: patientId, payload })
			.select('*')
			.single();
		if (err) throw err;
		setSurgeries((prev) => [data, ...prev]);
		return data;
	};

	const updateSurgery = async (id, payload) => {
		const sb = getBrowserSupabase();
		const { data, error: err } = await sb.from('patient_medical_history').update({ payload }).eq('id', id).select('*').single();
		if (err) throw err;
		setSurgeries((prev) => prev.map((r) => (r.id === id ? data : r)));
		return data;
	};

	const deleteSurgery = async (id) => {
		const sb = getBrowserSupabase();
		const { error: err } = await sb.from('patient_medical_history').delete().eq('id', id);
		if (err) throw err;
		setSurgeries((prev) => prev.filter((r) => r.id !== id));
	};

	const exportAllJson = () => {
		return JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				conditions: conditions.map((r) => r.payload),
				labResults: labs.map((r) => r.payload),
				allergies: allergies.map((r) => r.payload),
				surgeries: surgeries.map((r) => r.payload),
			},
			null,
			2
		);
	};

	return {
		patientId,
		loading,
		error,
		conditions,
		labs,
		allergies,
		surgeries,
		reload,
		insertCondition,
		updateCondition,
		deleteCondition,
		insertLab,
		updateLab,
		deleteLab,
		insertAllergy,
		updateAllergy,
		deleteAllergy,
		insertSurgery,
		updateSurgery,
		deleteSurgery,
		exportAllJson,
	};
}
