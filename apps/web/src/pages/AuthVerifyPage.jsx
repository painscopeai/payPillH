import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getDefaultRouteForUser } from '@/lib/authUtils.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';

/**
 * Email verification code entry — token length not limited (Supabase OTP formats vary).
 */
export default function AuthVerifyPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { verifyEmailOtp, error } = useAuth();
	const emailFromState = location.state?.email;
	const emailQuery = new URLSearchParams(location.search).get('email');
	const initialEmail = emailFromState || emailQuery || '';

	const [email, setEmail] = useState(initialEmail);
	const [code, setCode] = useState('');
	const [localError, setLocalError] = useState('');
	/** Local only — global AuthContext `isLoading` also tracks session bootstrap and login; tying the button to it caused endless spinners. */
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLocalError('');
		if (!email.trim()) {
			setLocalError('Email is required.');
			return;
		}
		if (!code.trim()) {
			setLocalError('Enter the verification code from your email.');
			return;
		}
		setBusy(true);
		try {
			const user = await verifyEmailOtp(email.trim(), code);
			const dest = getDefaultRouteForUser(user);
			navigate(dest, { replace: true });
		} catch (err) {
			setLocalError(err.message || 'Verification failed.');
		} finally {
			setBusy(false);
		}
	};

	const displayError = localError || error;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
			<Helmet><title>Verify email — PayPill</title></Helmet>

			<div className="w-full max-w-md space-y-6">
				<Button variant="ghost" className="-ml-4 text-muted-foreground" asChild>
					<Link to="/auth/individual"><ArrowLeft className="mr-2 h-4 w-4 inline" /> Back</Link>
				</Button>

				<Card className="rounded-2xl border-border/60 shadow-lg">
					<CardHeader className="text-center space-y-2">
						<div className="mx-auto bg-primary/10 p-3 rounded-2xl w-fit">
							<Mail className="h-8 w-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">Verify your email</CardTitle>
						<CardDescription>
							Enter the code we sent you. Paste the full code — any length is accepted.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							{displayError && (
								<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
									{displayError}
								</div>
							)}
							<div className="space-y-2">
								<Label htmlFor="verify-email">Email</Label>
								<Input
									id="verify-email"
									type="email"
									autoComplete="email"
									required
									className="rounded-xl"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="verify-code">Verification code</Label>
								<Input
									id="verify-code"
									type="text"
									inputMode="text"
									autoComplete="one-time-code"
									className="rounded-xl font-mono"
									placeholder="Paste code from email"
									value={code}
									onChange={(e) => setCode(e.target.value)}
								/>
							</div>
							<Button type="submit" className="w-full rounded-xl h-11" disabled={busy}>
								{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
								Verify and continue
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
