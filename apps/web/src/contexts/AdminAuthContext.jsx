import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
	const context = useContext(AdminAuthContext);
	if (!context) {
		throw new Error('useAdminAuth must be used within an AdminAuthProvider');
	}
	return context;
};

/**
 * Mirrors the main Supabase session: admins share the same login as everyone else.
 * Exposes legacy admin UI shape ({ currentAdmin, adminLogout }) without a second auth pipeline.
 */
export const AdminAuthProvider = ({ children }) => {
	const { currentUser, userRole, isLoading, logout, refreshProfile } = useAuth();

	const currentAdmin = useMemo(() => {
		if (userRole !== 'admin' || !currentUser) return null;
		return {
			...currentUser,
			email: currentUser.email ?? '',
		};
	}, [userRole, currentUser]);

	const adminLogout = useCallback(async () => {
		await logout();
	}, [logout]);

	const hasPermission = useCallback(() => true, []);

	const validateSession = useCallback(async () => refreshProfile(), [refreshProfile]);

	const value = useMemo(
		() => ({
			currentAdmin,
			isAdminAuthenticated: !!currentAdmin,
			isLoading,
			adminLogout,
			validateSession,
			hasPermission,
			admin: currentAdmin,
		}),
		[currentAdmin, isLoading, adminLogout, validateSession, hasPermission],
	);

	return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};
