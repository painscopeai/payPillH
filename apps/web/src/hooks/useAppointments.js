import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function useAppointments() {
	const { currentUser, userRole } = useAuth();
	const [appointments, setAppointments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchAppointments = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			let q = sb.from('appointments').select('*');

			if (userRole === 'provider') {
				const { data: prov } = await sb.from('providers').select('id').eq('user_id', currentUser.id).maybeSingle();
				if (prov?.id) {
					q = q.eq('provider_id', prov.id);
				} else {
					setAppointments([]);
					setError(null);
					setLoading(false);
					return;
				}
			} else {
				q = q.eq('user_id', currentUser.id);
			}

			const { data, error: qErr } = await q.order('appointment_date', { ascending: false });
			if (qErr) throw qErr;
			setAppointments(data || []);
			setError(null);
		} catch (err) {
			console.error('Error fetching appointments:', err);
			setError(err);
		} finally {
			setLoading(false);
		}
	}, [currentUser, userRole]);

	useEffect(() => {
		fetchAppointments();
	}, [fetchAppointments]);

	const createAppointment = async (data) => {
		const sb = getBrowserSupabase();
		const { data: row, error: insErr } = await sb
			.from('appointments')
			.insert({
				...data,
				user_id: currentUser.id,
			})
			.select()
			.single();
		if (insErr) throw insErr;
		await fetchAppointments();
		return row;
	};

	const updateAppointment = async (id, data) => {
		const sb = getBrowserSupabase();
		const { data: row, error: upErr } = await sb.from('appointments').update(data).eq('id', id).select().single();
		if (upErr) throw upErr;
		await fetchAppointments();
		return row;
	};

	return { appointments, loading, error, fetchAppointments, createAppointment, updateAppointment };
}
