import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getBrowserSupabase } from '@/lib/supabaseClient.js';
import { ensurePatientRecord } from '@/lib/authUtils.js';
import { toast } from 'sonner';

const AuthContext = createContext(null);

async function fetchProfileRow(sb, userId) {
	const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
	if (error) throw error;
	return data;
}

function mapRecord(profile, authUser) {
	if (!authUser) return null;
	const p = profile || {};
	return {
		...p,
		id: authUser.id,
		email: p.email ?? authUser.email ?? '',
		role: p.role ?? null,
	};
}

function mapSupabaseAuthError(err) {
	const msg = err?.message?.toLowerCase?.() || '';
	if (msg.includes('already registered') || msg.includes('user already')) {
		return new Error('This email is already registered. Try signing in or use a different email.');
	}
	if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
		return new Error('Invalid email or password.');
	}
	return new Error(err.message || 'Something went wrong.');
}

export const AuthProvider = ({ children }) => {
	const [currentUser, setCurrentUser] = useState(null);
	const [userRole, setUserRoleState] = useState(null);
	const [session, setSession] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const navigate = useNavigate();

	const applySession = useCallback(async (sess) => {
		setSession(sess);
		if (!sess?.user) {
			setCurrentUser(null);
			setUserRoleState(null);
			return null;
		}
		const sb = getBrowserSupabase();
		let profile = await fetchProfileRow(sb, sess.user.id);
		if (!profile) {
			const metaRole = sess.user.user_metadata?.role;
			const { error: insErr } = await sb.from('profiles').insert({
				id: sess.user.id,
				email: sess.user.email,
				role: ['individual', 'employer', 'insurance'].includes(metaRole) ? metaRole : 'individual',
			});
			if (!insErr) profile = await fetchProfileRow(sb, sess.user.id);
		}
		if (profile && !profile.role) {
			await sb.from('profiles').update({ role: 'individual' }).eq('id', sess.user.id);
			profile = await fetchProfileRow(sb, sess.user.id);
		}
		const user = mapRecord(profile, sess.user);
		setCurrentUser(user);
		setUserRoleState(user?.role ?? null);
		return user;
	}, []);

	useEffect(() => {
		if (!supabase) {
			setIsLoading(false);
			return;
		}

		let alive = true;

		(async () => {
			try {
				const { data: { session: initial } } = await supabase.auth.getSession();
				if (!alive) return;
				await applySession(initial);
			} catch (e) {
				console.error('[AuthContext]', e);
				setCurrentUser(null);
				setUserRoleState(null);
			} finally {
				if (alive) setIsLoading(false);
			}
		})();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
			if (!alive) return;
			await applySession(sess);
		});

		return () => {
			alive = false;
			subscription.unsubscribe();
		};
	}, [applySession]);

	const login = async (email, password) => {
		if (!supabase) throw new Error('Supabase is not configured.');
		setIsLoading(true);
		setError(null);
		try {
			let { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
			if (err && /lock|stole/i.test(err.message || '')) {
				const retry = await supabase.auth.signInWithPassword({ email, password });
				data = retry.data;
				err = retry.error;
			}
			if (err) throw mapSupabaseAuthError(err);
			return await applySession(data.session);
		} catch (err) {
			console.error('[AuthContext] Login error:', err);
			setError(err.message);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	/**
	 * Sign up; returns { needsVerification: true, email } when email confirmation is required,
	 * or { user } when session is immediately available.
	 */
	const signup = async (email, password, userData = {}, role = 'individual') => {
		if (!supabase) throw new Error('Supabase is not configured.');
		setIsLoading(true);
		setError(null);
		try {
			const { data, error: err } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						first_name: userData.first_name ?? '',
						last_name: userData.last_name ?? '',
						role,
						user_type: role,
						phone: userData.phone ?? '',
						date_of_birth: userData.date_of_birth ?? '',
						preferred_username: userData.preferred_username ?? '',
						terms_accepted: userData.terms_accepted ? 'true' : 'false',
						privacy_preferences: userData.privacy_preferences ? 'true' : 'false',
					},
				},
			});
			if (err) throw mapSupabaseAuthError(err);

			if (data.user && !data.session) {
				return { needsVerification: true, email };
			}

			await applySession(data.session);
			const u = mapRecord(await fetchProfileRow(supabase, data.user.id), data.user);
			return { user: u };
		} catch (err) {
			console.error('[AuthContext] Signup error:', err);
			setError(err.message);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const verifyEmailOtp = async (email, token) => {
		const sb = getBrowserSupabase();
		setIsLoading(true);
		setError(null);
		try {
			const tokenStr = String(token).trim();
			let { data, error: err } = await sb.auth.verifyOtp({
				email,
				token: tokenStr,
				type: 'signup',
			});
			if (err) {
				const retry = await sb.auth.verifyOtp({ email, token: tokenStr, type: 'email' });
				data = retry.data;
				err = retry.error;
			}
			if (err) throw new Error(err.message || 'Invalid or expired code.');
			await applySession(data.session);
			await ensurePatientRecord(data.session.user.id);
			const profile = await fetchProfileRow(sb, data.session.user.id);
			return mapRecord(profile, data.session.user);
		} catch (err) {
			setError(err.message);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		if (supabase) await supabase.auth.signOut();
		setCurrentUser(null);
		setUserRoleState(null);
		setSession(null);
		navigate('/');
	};

	const setUserRole = async (role) => {
		if (!currentUser?.id) return;
		const sb = getBrowserSupabase();
		setIsLoading(true);
		try {
			const { error: err } = await sb.from('profiles').update({ role }).eq('id', currentUser.id);
			if (err) throw err;
			const profile = await fetchProfileRow(sb, currentUser.id);
			setCurrentUser(mapRecord(profile, { id: currentUser.id, email: currentUser.email }));
			setUserRoleState(role);
			return mapRecord(profile, { id: currentUser.id, email: currentUser.email });
		} catch (err) {
			console.error('[AuthContext] setUserRole:', err);
			toast.error('Failed to update role.');
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const value = {
		currentUser,
		userRole,
		session,
		isLoading,
		error,
		login,
		logout,
		signup,
		verifyEmailOtp,
		setUserRole,
		isAuthenticated: !!session?.user,
		refreshProfile: async () => {
			const sb = getBrowserSupabase();
			const { data: { session: s } } = await sb.auth.getSession();
			return applySession(s);
		},
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
