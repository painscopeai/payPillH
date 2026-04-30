import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { ensurePatientRowId } from '@/lib/patientHelpers.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function useRecommendations() {
	const { currentUser } = useAuth();
	const [recommendations, setRecommendations] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchRecommendations = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const patientId = await ensurePatientRowId(currentUser.id);
			const { data, error } = await sb
				.from('patient_recommendations')
				.select('*')
				.eq('patient_id', patientId)
				.order('created_at', { ascending: false });
			if (error) throw error;
			setRecommendations(data || []);
		} catch (err) {
			console.error('Error fetching recommendations:', err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchRecommendations();
	}, [fetchRecommendations]);

	const updateRecommendationStatus = async (id, status) => {
		const sb = getBrowserSupabase();
		const { data: row, error } = await sb.from('patient_recommendations').update({ status }).eq('id', id).select().single();
		if (error) throw error;
		await fetchRecommendations();
		return row;
	};

	return { recommendations, loading, fetchRecommendations, updateRecommendationStatus };
}
