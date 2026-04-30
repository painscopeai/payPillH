
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';

export default function ProtectedAdminRoute({ children }) {
	const { isAuthenticated, userRole, currentUser, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	if (!isAuthenticated || !currentUser || userRole !== 'admin') {
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate
				to="/auth/login"
				state={{ returnTo, from: location }}
				replace
			/>
		);
	}

	return <>{children}</>;
}
