import { useState, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export const usePaymentRouting = () => {
	const { currentUser } = useAuth();
	const [rules, setRules] = useState([]);
	const [loading, setLoading] = useState(false);

	const fetchRules = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: employerRows } = await sb.from('employers').select('id').eq('owner_user_id', currentUser.id);
			const employerIds = (employerRows || []).map((e) => e.id);
			if (employerIds.length === 0) {
				setRules([]);
				return;
			}
			const { data: records, error } = await sb.from('payment_routing_rules').select('*').in('employer_id', employerIds);
			if (error) throw error;
			setRules(records || []);
		} catch (error) {
			console.error('Error fetching routing rules:', error);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	return { rules, loading, fetchRules };
};
