import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useAdminAuth } from '@/contexts/AdminAuthContext.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';

export default function ProtectedAdminRoute({ children }) {
  const { isAdminAuthenticated, isLoading: adminAuthLoading } = useAdminAuth();
  const { isLoading: authLoading, isAuthenticated, userRole } = useAuth();
  const location = useLocation();

  const loading = authLoading || adminAuthLoading;
  const allowedAsAdmin =
    isAdminAuthenticated || (isAuthenticated && userRole === 'admin');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!allowedAsAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
