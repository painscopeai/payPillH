import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import BrandLogo from '@/components/BrandLogo.jsx';

const DEFAULT_RETURN = '/auth/individual';

const PASSWORD_MIN = 8;

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const searchReturn = useMemo(() => new URLSearchParams(location.search).get('return'), [location.search]);
	const returnPath = location.state?.returnPath ?? searchReturn ?? DEFAULT_RETURN;
	const emailFromNavigate = location.state?.email ?? '';

	const [step, setStep] = useState('otp');
	const [email, setEmail] = useState(emailFromNavigate);
	const [code, setCode] = useState('');
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [localError, setLocalError] = useState('');
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!supabase) return undefined;
		const { data } = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'PASSWORD_RECOVERY' && session?.user?.email) {
				setEmail(session.user.email);
				setStep('password');
			}
		});
		return () => data.subscription.unsubscribe();
	}, []);

	useEffect(() => {
		let alive = true;
		(async () => {
			if (!supabase) return;
			const { data } = await supabase.auth.getSession();
			const session = data.session;
			if (!alive || !session?.user?.email) return;
			const hash = typeof window.location.hash === 'string' ? window.location.hash : '';
			if (hash.includes('type=recovery') || hash.includes('access_token')) {
				setEmail(session.user.email);
				setStep('password');
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	const handleVerifyCode = async (e) => {
		e.preventDefault();
		setLocalError('');
		const trimmedEmail = email.trim();
		const token = code.trim().replace(/\s+/g, '');
		if (!trimmedEmail) {
			setLocalError('Enter your email address.');
			return;
		}
		if (!token) {
			setLocalError('Enter the verification code from your email.');
			return;
		}
		if (!supabase) {
			setLocalError('Supabase is not configured.');
			return;
		}
		setBusy(true);
		try {
			const { data, error: err } = await supabase.auth.verifyOtp({
				email: trimmedEmail,
				token,
				type: 'recovery',
			});
			if (err) throw err;
			if (!data.session) throw new Error('Could not verify that code.');
			toast.success('Code verified — choose a new password.');
			setStep('password');
		} catch (err) {
			console.error('[ResetPassword] verify OTP', err);
			setLocalError(err.message || 'Invalid or expired code.');
		} finally {
			setBusy(false);
		}
	};

	const handleSetPassword = async (e) => {
		e.preventDefault();
		setLocalError('');
		if (password.length < PASSWORD_MIN) {
			setLocalError(`Password must be at least ${PASSWORD_MIN} characters.`);
			return;
		}
		if (password !== confirm) {
			setLocalError('Passwords do not match.');
			return;
		}
		if (!supabase) {
			setLocalError('Supabase is not configured.');
			return;
		}
		setBusy(true);
		try {
			const { error: err } = await supabase.auth.updateUser({ password });
			if (err) throw err;
			toast.success('Password updated. Sign in with your new password.');
			await supabase.auth.signOut();
			const dest = typeof returnPath === 'string' && returnPath.startsWith('/') ? returnPath : DEFAULT_RETURN;
			navigate(dest, { replace: true });
		} catch (err) {
			console.error('[ResetPassword] update password', err);
			setLocalError(err.message || 'Could not save password.');
		} finally {
			setBusy(false);
		}
	};

	const showForgotReminder = step === 'otp' && !emailFromNavigate && !email;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
			<Helmet>
				<title>Reset password — PayPill</title>
			</Helmet>

			<div className="w-full max-w-md space-y-6">
				<Button variant="ghost" className="-ml-4 text-muted-foreground" type="button" asChild>
					<Link to={returnPath}>
						<ArrowLeft className="mr-2 h-4 w-4 inline" /> Back to sign in
					</Link>
				</Button>

				<div className="flex flex-col items-center text-center gap-2">
					<BrandLogo className="h-14 w-auto" />
				</div>

				{showForgotReminder && (
					<p className="text-center text-sm text-muted-foreground">
						Start from{' '}
						<Link to="/auth/forgot-password" className="text-primary font-medium underline" state={{ returnPath }}>
							forgot password
						</Link>{' '}
						first, or use the recovery link from your email.
					</p>
				)}

				{step === 'otp' && (
					<Card className="rounded-2xl border-border/60 shadow-lg">
						<CardHeader className="text-center space-y-2">
							<div className="mx-auto bg-primary/10 p-3 rounded-2xl w-fit">
								<Lock className="h-8 w-8 text-primary" />
							</div>
							<CardTitle className="text-2xl">Enter verification code</CardTitle>
							<CardDescription>
								Check your inbox for your reset code or open the recovery link from the same browser.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleVerifyCode} className="space-y-4">
								{localError && (
									<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
										{localError}
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="reset-email">Email</Label>
									<Input
										id="reset-email"
										type="email"
										required
										autoComplete="email"
										className="rounded-xl"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="reset-code">Verification code</Label>
									<Input
										id="reset-code"
										autoComplete="one-time-code"
										className="rounded-xl tracking-wider"
										placeholder="Paste the code"
										value={code}
										onChange={(e) => setCode(e.target.value)}
									/>
								</div>
								<Button type="submit" className="w-full rounded-xl h-11" disabled={busy}>
									{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
									Continue
								</Button>
							</form>
						</CardContent>
					</Card>
				)}

				{step === 'password' && (
					<Card className="rounded-2xl border-border/60 shadow-lg">
						<CardHeader className="text-center space-y-2">
							<CardTitle className="text-2xl">New password</CardTitle>
							<CardDescription>You can now set a new password for {email}</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSetPassword} className="space-y-4">
								{localError && (
									<div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
										{localError}
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="new-pass">New password</Label>
									<Input
										id="new-pass"
										type="password"
										autoComplete="new-password"
										minLength={PASSWORD_MIN}
										className="rounded-xl"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="confirm-pass">Confirm password</Label>
									<Input
										id="confirm-pass"
										type="password"
										autoComplete="new-password"
										minLength={PASSWORD_MIN}
										className="rounded-xl"
										value={confirm}
										onChange={(e) => setConfirm(e.target.value)}
										required
									/>
								</div>
								<Button type="submit" className="w-full rounded-xl h-11" disabled={busy}>
									{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
									Save password
								</Button>
							</form>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
