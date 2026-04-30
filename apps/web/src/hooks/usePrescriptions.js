import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function usePrescriptions() {
	const { currentUser } = useAuth();
	const [prescriptions, setPrescriptions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchPrescriptions = useCallback(async () => {
		const userId = currentUser?.id;

		if (!userId) {
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const sb = getBrowserSupabase();
			const { data, error: qErr } = await sb
				.from('prescriptions')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(50);

			if (qErr) throw qErr;
			setPrescriptions(data || []);
		} catch (err) {
			console.error('Error fetching prescriptions:', err);
			setError(err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchPrescriptions();
	}, [fetchPrescriptions]);

	const createPrescription = async (data) => {
		const sb = getBrowserSupabase();
		const { data: prov } = await sb.from('providers').select('id').eq('user_id', currentUser.id).maybeSingle();
		if (!prov?.id) {
			throw new Error('Provider profile required to create prescriptions');
		}
		const { data: row, error: insErr } = await sb
			.from('prescriptions')
			.insert({
				...data,
				provider_id: prov.id,
				user_id: data.user_id || currentUser.id,
			})
			.select()
			.single();
		if (insErr) throw insErr;

		await fetchPrescriptions();
		return row;
	};

	return {
		prescriptions,
		loading,
		error,
		refetch: fetchPrescriptions,
		createPrescription,
	};
}
