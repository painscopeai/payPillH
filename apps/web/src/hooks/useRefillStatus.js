import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function useRefillStatus() {
	const { currentUser } = useAuth();
	const [refills, setRefills] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchRefills = useCallback(async () => {
		const userId = currentUser?.id;

		if (!userId) {
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const sb = getBrowserSupabase();
			const { data: items, error: qErr } = await sb
				.from('refill_requests')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(50);

			if (qErr) throw qErr;

			const prescriptionIds = [...new Set((items || []).map((r) => r.prescription_id).filter(Boolean))];
			let prescriptionsMap = {};

			if (prescriptionIds.length > 0) {
				const { data: presData } = await sb.from('prescriptions').select('*').in('id', prescriptionIds);
				(presData || []).forEach((p) => {
					prescriptionsMap[p.id] = p;
				});
			}

			const enrichedRefills = (items || []).map((refill) => ({
				...refill,
				prescription_details: prescriptionsMap[refill.prescription_id] || null,
			}));

			setRefills(enrichedRefills);
		} catch (err) {
			console.error('Error fetching refill status:', err);
			setError(err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchRefills();
	}, [fetchRefills]);

	return {
		refills,
		loading,
		error,
		refetch: fetchRefills,
	};
}
