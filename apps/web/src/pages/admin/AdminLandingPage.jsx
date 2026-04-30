
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';

export default function AdminLandingPage() {
	const { isAuthenticated, userRole, currentUser, isLoading } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isLoading) return;

		if (!isAuthenticated || !currentUser) {
			navigate('/auth/login', {
				replace: true,
				state: { returnTo: '/admin/dashboard' },
			});
			return;
		}

		if (userRole !== 'admin') {
			toast.error('This account is not authorized for admin access.');
			navigate('/', { replace: true });
			return;
		}

		navigate('/admin/dashboard', { replace: true });
	}, [isAuthenticated, isLoading, userRole, currentUser, navigate]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="text-center space-y-4">
				<LoadingSpinner size="lg" />
				<p className="text-muted-foreground font-medium animate-pulse">Initializing Admin Portal...</p>
			</div>
		</div>
	);
}
