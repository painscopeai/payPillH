import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';

export function usePharmacies() {
	const [pharmacies, setPharmacies] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchPharmacies = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const sb = getBrowserSupabase();
			const { data, error: qErr } = await sb.from('pharmacies').select('*').order('name', { ascending: true }).limit(50);
			if (qErr) throw qErr;
			setPharmacies(data || []);
		} catch (err) {
			console.error('Error fetching pharmacies:', err);
			setError(err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchPharmacies();
	}, [fetchPharmacies]);

	return {
		pharmacies,
		loading,
		error,
		refetch: fetchPharmacies,
	};
}
