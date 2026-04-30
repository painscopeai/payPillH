import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/** Legacy `/admin/login` — forwards to unified sign-in. */
export default function AdminLoginRedirect() {
	const location = useLocation();
	const returnTo =
		location.state?.returnTo ??
		location.state?.from?.pathname ??
		`/admin/dashboard${location.search ?? ''}`;
	return <Navigate to="/auth/login" replace state={{ ...location.state, returnTo }} />;
}
