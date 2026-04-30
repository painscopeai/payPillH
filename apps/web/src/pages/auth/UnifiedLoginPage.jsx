import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getDefaultRouteForUser, sanitizeInternalPath } from '@/lib/authUtils.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo.jsx';

export default function UnifiedLoginPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { login, isAuthenticated, currentUser, isLoading, error } = useAuth();

	const returnTo = useMemo(() => {
		const fromState = location.state?.returnTo ?? location.state?.from?.pathname;
		const qs = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('next') : null;
		return sanitizeInternalPath(fromState) ?? sanitizeInternalPath(qs ?? '') ?? null;
	}, [location.state, location.search]);

	const signupReturnLabel = location.state?.returnPath;
	const prefilledEmail = typeof location.state?.email === 'string' ? location.state.email : '';

	const [email, setEmail] = useState(prefilledEmail);
	const [password, setPassword] = useState('');
	const [localError, setLocalError] = useState('');

	useEffect(() => {
		if (!isAuthenticated || isLoading) return;
		const dest = sanitizeInternalPath(returnTo) ?? getDefaultRouteForUser(currentUser);
		navigate(dest, { replace: true });
	}, [isAuthenticated, isLoading, currentUser, returnTo, navigate]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLocalError('');
		try {
			const user = await login(email.trim(), password);
			const next = sanitizeInternalPath(returnTo) ?? getDefaultRouteForUser(user);
			navigate(next, { replace: true });
		} catch (err) {
			setLocalError(err?.message || 'Sign in failed.');
		}
	};

	const displayError = localError || error;

	if (isLoading && !isAuthenticated) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
			<Helmet>
				<title>Sign in — PayPill</title>
			</Helmet>

			<div className="w-full max-w-md space-y-6">
				<Button variant="ghost" className="-ml-4 text-muted-foreground" asChild type="button">
					<Link to="/">← Back to home</Link>
				</Button>

				<div className="flex flex-col items-center text-center gap-2">
					<BrandLogo className="h-14 w-auto" />
					<p className="text-muted-foreground text-sm">
						Use one account for every PayPill portal, including administration.
					</p>
				</div>

				<Card className="rounded-2xl border-border/60 shadow-lg">
					<CardHeader>
						<CardTitle className="text-xl">Sign in</CardTitle>
						<CardDescription>Enter your email and password.</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							{displayError ? (
								<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
									{displayError}
								</div>
							) : null}
							<div className="space-y-2">
								<Label htmlFor="login-email">Email</Label>
								<Input
									id="login-email"
									type="email"
									autoComplete="email"
									required
									className="rounded-xl"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="login-password">Password</Label>
									<Button variant="link" className="p-0 h-auto text-xs font-medium" type="button" asChild>
										<Link to="/auth/forgot-password" state={{ email: email.trim(), returnPath: '/auth/login' }}>
											Forgot password?
										</Link>
									</Button>
								</div>
								<Input
									id="login-password"
									type="password"
									autoComplete="current-password"
									required
									className="rounded-xl"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>
							<Button type="submit" className="w-full rounded-xl h-11" disabled={isLoading}>
								{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
								Sign in
							</Button>

							{signupReturnLabel ? (
								<p className="text-center text-sm text-muted-foreground">
									New to this portal?{' '}
									<Button variant="link" className="p-0 h-auto text-sm font-medium" asChild type="button">
										<Link to={signupReturnLabel}>Create an account</Link>
									</Button>
								</p>
							) : null}
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
