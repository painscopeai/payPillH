import { useState, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

export const useEmployerData = () => {
	const { currentUser } = useAuth();
	const [loading, setLoading] = useState(false);
	const [employees, setEmployees] = useState([]);
	const [metrics, setMetrics] = useState([]);

	const fetchEmployees = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: employer } = await sb.from('employers').select('id').eq('owner_user_id', currentUser.id).maybeSingle();
			if (!employer?.id) {
				setEmployees([]);
				return;
			}
			const { data: records, error } = await sb.from('employer_employees').select('*').eq('employer_id', employer.id);
			if (error) throw error;
			setEmployees(records || []);
		} catch (error) {
			console.error('Error fetching employees:', error);
			toast.error('Failed to load employees');
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	const fetchMetrics = useCallback(async () => {
		if (!currentUser?.id) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data: employer } = await sb.from('employers').select('id').eq('owner_user_id', currentUser.id).maybeSingle();
			if (!employer?.id) {
				setMetrics([]);
				return;
			}
			const { data: records, error } = await sb.from('employer_health_metrics').select('*').eq('employer_id', employer.id);
			if (error) throw error;
			setMetrics(records || []);
		} catch (error) {
			console.error('Error fetching metrics:', error);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	return { employees, metrics, loading, fetchEmployees, fetchMetrics };
};
