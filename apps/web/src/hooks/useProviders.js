import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';

export function useProviders() {
	const [providers, setProviders] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchProviders = useCallback(async () => {
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data, error } = await sb
				.from('providers')
				.select('*, provider_profiles(*)')
				.order('created_at', { ascending: false });
			if (error) throw error;
			setProviders(data || []);
		} catch (err) {
			console.error('Error fetching providers:', err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchProviders();
	}, [fetchProviders]);

	return { providers, loading, fetchProviders };
}
