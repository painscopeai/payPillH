import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

export function useMessages() {
	const { currentUser } = useAuth();
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(true);

	const fetchMessages = useCallback(async () => {
		if (!currentUser) return;
		setLoading(true);
		try {
			const sb = getBrowserSupabase();
			const uid = currentUser.id;
			const { data, error } = await sb
				.from('messages')
				.select('*')
				.or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
				.order('created_at', { ascending: false });
			if (error) throw error;
			setMessages(data || []);
		} catch (err) {
			console.error('Error fetching messages:', err);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	const sendMessage = async (data) => {
		const sb = getBrowserSupabase();
		const { data: row, error } = await sb
			.from('messages')
			.insert({
				...data,
				sender_id: currentUser.id,
				payload: {
					read_status: false,
					...(data.payload && typeof data.payload === 'object' ? data.payload : {}),
				},
			})
			.select()
			.single();
		if (error) throw error;
		await fetchMessages();
		return row;
	};

	return { messages, loading, fetchMessages, sendMessage };
}
