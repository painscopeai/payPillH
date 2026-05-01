import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { sleepRace } from '@/lib/sleepRace.js';
import { toast } from 'sonner';

const GET_SESSION_MS = 12_000;
const PROFILE_FETCH_MS = 12_000;

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
	const context = useContext(AdminAuthContext);
	if (!context) {
		throw new Error('useAdminAuth must be used within an AdminAuthProvider');
	}
	return context;
};

async function fetchAdminProfile(userId) {
	if (!supabase) return null;
	const q = supabase
		.from('profiles')
		.select('id, email, role, first_name, last_name')
		.eq('id', userId)
		.maybeSingle();
	const { data, error } = await sleepRace(q, PROFILE_FETCH_MS).catch(() => ({
		data: null,
		error: { message: 'Profile request timed out' },
	}));
	if (error) throw error;
	return data;
}

export const AdminAuthProvider = ({ children }) => {
	const [currentAdmin, setCurrentAdmin] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const navigate = useNavigate();

	const applySessionToAdmin = useCallback(async (session) => {
		if (!session?.user) {
			setCurrentAdmin(null);
			return false;
		}
		try {
			const prof = await fetchAdminProfile(session.user.id);
			if (prof?.role === 'admin') {
				setCurrentAdmin({
					...prof,
					email: prof.email || session.user.email,
				});
				return true;
			}
		} catch (e) {
			// #region agent log
			fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'AdminAuthContext.jsx:applySessionToAdmin',message:'admin_auth_profile_failed',data:{err:String(e?.message||e).slice(0,220)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
			// #endregion
			console.error('[AdminAuth] profile check failed', e);
		}
		setCurrentAdmin(null);
		return false;
	}, []);

	useEffect(() => {
		if (!supabase) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const { data: { session } } = await sleepRace(supabase.auth.getSession(), GET_SESSION_MS).catch(() => ({
					data: { session: null },
				}));
				if (!cancelled) await applySessionToAdmin(session);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_evt, session) => {
			await applySessionToAdmin(session);
		});

		return () => {
			cancelled = true;
			subscription.unsubscribe();
		};
	}, [applySessionToAdmin]);

	const adminLogin = async (email, password) => {
		if (!supabase) {
			toast.error('Authentication is not configured');
			return { success: false };
		}
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			toast.error(error.message || 'Invalid credentials');
			return { success: false };
		}
		try {
			const prof = await fetchAdminProfile(data.user.id);
			if (prof?.role !== 'admin') {
				await supabase.auth.signOut();
				toast.error('This account is not authorized for admin access.');
				return { success: false };
			}
			setCurrentAdmin({
				...prof,
				email: prof.email || data.user.email,
			});
			toast.success('Logged in successfully');
			return { success: true };
		} catch (e) {
			await supabase.auth.signOut().catch(() => {});
			toast.error(e.message || 'Login failed');
			return { success: false };
		}
	};

	const adminLogout = async () => {
		await supabase?.auth.signOut().catch(() => {});
		setCurrentAdmin(null);
		toast.success('Logged out successfully');
		navigate('/admin/login');
	};

	const validateSession = useCallback(async () => {
		if (!supabase) return false;
		const { data: { session } } = await sleepRace(supabase.auth.getSession(), GET_SESSION_MS).catch(() => ({
			data: { session: null },
		}));
		return applySessionToAdmin(session);
	}, [applySessionToAdmin]);

	const value = {
		currentAdmin,
		isAdminAuthenticated: !!currentAdmin,
		isLoading,
		adminLogin,
		adminLogout,
		validateSession,
	};

	return (
		<AdminAuthContext.Provider value={value}>
			{children}
		</AdminAuthContext.Provider>
	);
};
