import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import BrandLogo from '@/components/BrandLogo.jsx';

/** Default when opened without navigation state (e.g. bookmark). */
const DEFAULT_RETURN = '/auth/login';

export default function ForgotPasswordPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const searchReturn = useMemo(() => new URLSearchParams(location.search).get('return'), [location.search]);
	const returnPath = location.state?.returnPath ?? searchReturn ?? DEFAULT_RETURN;
	const prefilledEmail = location.state?.email ?? '';

	const [email, setEmail] = useState(prefilledEmail);
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		const trimmed = email.trim();
		if (!trimmed) {
			toast.error('Enter your email address.');
			return;
		}
		if (!supabase) {
			toast.error('Supabase is not configured.');
			return;
		}
		setBusy(true);
		try {
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			const redirectTo = `${origin}/auth/reset-password`;
			const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
			if (error) throw error;
			toast.success('Check your email for your verification code (or recovery link).');
			navigate('/auth/reset-password', {
				state: { email: trimmed, returnPath },
				replace: true,
			});
		} catch (err) {
			console.error('[ForgotPassword]', err);
			toast.error(err.message || 'Failed to send reset email.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
			<Helmet>
				<title>Forgot password — PayPill</title>
			</Helmet>

			<div className="w-full max-w-md space-y-6">
				<Button variant="ghost" className="-ml-4 text-muted-foreground" asChild type="button">
					<Link to={returnPath}>
						<ArrowLeft className="mr-2 h-4 w-4 inline" /> Back to sign in
					</Link>
				</Button>

				<div className="flex flex-col items-center text-center gap-2">
					<BrandLogo className="h-14 w-auto" />
				</div>

				<Card className="rounded-2xl border-border/60 shadow-lg">
					<CardHeader className="text-center space-y-2">
						<div className="mx-auto bg-primary/10 p-3 rounded-2xl w-fit">
							<KeyRound className="h-8 w-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">Reset your password</CardTitle>
						<CardDescription>
							Enter the email on your account. We&apos;ll send a verification code (or recovery link) so you can
							choose a new password.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="forgot-email">Email</Label>
								<Input
									id="forgot-email"
									type="email"
									required
									autoComplete="email"
									className="rounded-xl"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<Button type="submit" className="w-full rounded-xl h-11" disabled={busy}>
								{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
								Send reset email
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
