import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function useHealthGoals() {
	const { currentUser } = useAuth();
	const [goals, setGoals] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchGoals = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const { data, error } = await sb
				.from('health_goals')
				.select('*')
				.eq('user_id', currentUser.id)
				.order('created_at', { ascending: false });
			if (error) throw error;
			setGoals(data || []);
		} catch (err) {
			console.error('Error fetching health goals:', err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchGoals();
	}, [fetchGoals]);

	const createGoal = async (data) => {
		const sb = getBrowserSupabase();
		const targetDate = data.target_date;
		const { data: row, error } = await sb
			.from('health_goals')
			.insert({
				user_id: currentUser.id,
				goal_type: data.goal_type,
				title: data.goal_name || data.title,
				status: 'active',
				target: {
					target_value: data.target_value,
					target_date: targetDate,
				},
			})
			.select()
			.single();
		if (error) throw error;
		await fetchGoals();
		return row;
	};

	const updateGoal = async (id, data) => {
		const sb = getBrowserSupabase();
		const payload = { ...data };
		if (data.goal_name) {
			payload.title = data.goal_name;
			delete payload.goal_name;
		}
		const { data: row, error } = await sb.from('health_goals').update(payload).eq('id', id).select().single();
		if (error) throw error;
		await fetchGoals();
		return row;
	};

	const deleteGoal = async (id) => {
		const sb = getBrowserSupabase();
		const { error } = await sb.from('health_goals').delete().eq('id', id);
		if (error) throw error;
		await fetchGoals();
	};

	return { goals, loading, fetchGoals, createGoal, updateGoal, deleteGoal };
}
