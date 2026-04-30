import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function usePatients() {
	const { currentUser } = useAuth();
	const [patients, setPatients] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchPatients = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: prov } = await sb.from('providers').select('id').eq('user_id', currentUser.id).maybeSingle();
			if (!prov?.id) {
				setPatients([]);
				return;
			}
			const { data: relationships, error } = await sb
				.from('patient_provider_relationships')
				.select('*')
				.eq('provider_id', prov.id);
			if (error) throw error;
			setPatients(relationships || []);
		} catch (err) {
			console.error('Error fetching patients:', err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchPatients();
	}, [fetchPatients]);

	return { patients, loading, fetchPatients };
}
