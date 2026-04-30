
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';

export default function AdminLandingPage() {
  const { isAdminAuthenticated, isLoading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAdminAuthenticated) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/admin/login', { replace: true });
      }
    }
  }, [isAdminAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground font-medium animate-pulse">Initializing Admin Portal...</p>
      </div>
    </div>
  );
}
