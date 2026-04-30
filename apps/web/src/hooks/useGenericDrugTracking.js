import { useState, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const useGenericDrugTracking = () => {
	const { currentUser } = useAuth();
	const [trackingData, setTrackingData] = useState([]);
	const [loading, setLoading] = useState(false);

	const fetchTrackingData = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: companies } = await sb.from('insurance_companies').select('id').eq('user_id', currentUser.id);
			const companyIds = (companies || []).map((c) => c.id);
			if (companyIds.length === 0) {
				setTrackingData([]);
				return;
			}
			const { data: records, error } = await sb.from('generic_drug_tracking').select('*').in('company_id', companyIds);
			if (error) throw error;
			setTrackingData(records || []);
		} catch (error) {
			console.error('Error fetching generic drug data:', error);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	return { trackingData, loading, fetchTrackingData };
};
