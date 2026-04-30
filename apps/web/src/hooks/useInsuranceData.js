import { useState, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

export const useInsuranceData = () => {
	const { currentUser } = useAuth();
	const [loading, setLoading] = useState(false);
	const [members, setMembers] = useState([]);
	const [claims, setClaims] = useState([]);

	const fetchMembers = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: companies } = await sb.from('insurance_companies').select('id').eq('user_id', currentUser.id);
			const companyIds = (companies || []).map((c) => c.id);
			if (companyIds.length === 0) {
				setMembers([]);
				return;
			}
			const { data: records, error } = await sb.from('insurance_members').select('*').in('company_id', companyIds);
			if (error) throw error;
			setMembers(records || []);
		} catch (error) {
			console.error('Error fetching members:', error);
			toast.error('Failed to load members');
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	const fetchClaims = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: companies } = await sb.from('insurance_companies').select('id').eq('user_id', currentUser.id);
			const companyIds = (companies || []).map((c) => c.id);
			if (companyIds.length === 0) {
				setClaims([]);
				return;
			}
			const { data: memberRows } = await sb.from('insurance_members').select('id').in('company_id', companyIds);
			const memberIds = (memberRows || []).map((m) => m.id);
			if (memberIds.length === 0) {
				setClaims([]);
				return;
			}
			const { data: records, error } = await sb.from('insurance_claims').select('*').in('member_id', memberIds);
			if (error) throw error;
			setClaims(records || []);
		} catch (error) {
			console.error('Error fetching claims:', error);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	return { members, claims, loading, fetchMembers, fetchClaims };
};
