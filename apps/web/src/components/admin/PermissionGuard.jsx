
import React from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export default function PermissionGuard({ module, action, children, fallback }) {
  const { hasPermission, admin } = useAdminAuth();

  if (!admin) {
    return fallback || (
      <Alert variant="destructive" className="m-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>You must be logged in to access this feature.</AlertDescription>
      </Alert>
    );
  }

  if (!hasPermission(module, action)) {
    return fallback || (
      <Alert variant="destructive" className="m-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to {action} {module}. Contact your administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
