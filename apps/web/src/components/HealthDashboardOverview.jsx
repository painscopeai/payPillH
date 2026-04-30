import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Activity, HeartPulse, Pill, Calendar, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiServerClient from '@/lib/apiServerClient.js';

function formatDelta(delta) {
	if (delta == null || Number.isNaN(delta)) return null;
	const sign = delta > 0 ? '+' : '';
	return `${sign}${delta}%`;
}

export default function HealthDashboardOverview() {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await apiServerClient.fetch('/health/patient-dashboard-metrics');
				if (!res.ok) {
					const t = await res.text();
					throw new Error(t || `HTTP ${res.status}`);
				}
				const json = await res.json();
				if (!cancelled) setData(json);
			} catch (e) {
				if (!cancelled) setError(e.message || 'Could not load dashboard metrics');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
				<Loader2 className="h-6 w-6 animate-spin" />
				<span>Loading your health overview…</span>
			</div>
		);
	}

	if (error || !data) {
		return (
			<Card className="border-destructive/50">
				<CardContent className="pt-6 text-destructive">
					{error || 'Unable to load metrics.'}
				</CardContent>
			</Card>
		);
	}

	const cvd = data.cvd || {};
	const chronic = data.chronicBurden || {};
	const adherence = data.adherence || {};
	const vitalsSeries = Array.isArray(data.vitalsSeries) ? data.vitalsSeries : [];
	const gaps = Array.isArray(data.preventiveGaps) ? data.preventiveGaps : [];
	const trend = data.trend || {};

	const cvdProgress = Math.min(100, Math.max(0, Number(cvd.value) || 0));

	const chronicProgress = Math.min(100, Math.max(0, Number(chronic.value) || 0));

	const deltaLabel = formatDelta(trend.cvdDeltaPercent);
	const chartData = vitalsSeries.map((row, i) => ({
		name: row.name || `V${i + 1}`,
		value: row.value,
	}));

	return (
		<div className="space-y-8">
			<p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
				{data.disclaimer}
			</p>

			{data.degraded ? (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
					Limited metrics (service was slow to respond). Try refreshing, or check back later.
				</div>
			) : null}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card className="shadow-sm border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
							<Activity className="w-4 h-4 mr-2 text-primary" /> {cvd.label || 'Cardiovascular metric'}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-foreground">{Number(cvd.value).toFixed(1)}</div>
						<p className="text-xs text-muted-foreground mt-1">{cvd.subtitle}</p>
						{deltaLabel != null && trend.hasHistory ? (
							<p className="text-xs text-muted-foreground mt-1">{deltaLabel} vs last saved snapshot</p>
						) : null}
						<Progress value={cvdProgress} className="h-2 mt-3 bg-muted" />
						<p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wide">
							Wellness score (0–100) · {data.provenance?.confidence || '—'} data quality
						</p>
					</CardContent>
				</Card>

				<Card className="shadow-sm border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
							<HeartPulse className="w-4 h-4 mr-2 text-destructive" /> {chronic.label || 'Chronic burden'}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-foreground">{Number(chronic.value).toFixed(1)}%</div>
						<p className="text-xs text-muted-foreground mt-1">{chronic.subtitle}</p>
						<Progress value={chronicProgress} className="h-2 mt-3 bg-muted" />
					</CardContent>
				</Card>

				<Card className="shadow-sm border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
							<Pill className="w-4 h-4 mr-2 text-secondary" /> Medication adherence
						</CardTitle>
					</CardHeader>
					<CardContent>
						{adherence.score != null ? (
							<>
								<div className="text-3xl font-bold text-foreground">{adherence.score}%</div>
								<p className="text-xs text-muted-foreground mt-1">{adherence.subtitle}</p>
								<Progress value={adherence.score} className="h-2 mt-3 bg-muted" />
							</>
						) : (
							<>
								<div className="text-2xl font-semibold text-muted-foreground">—</div>
								<p className="text-xs text-muted-foreground mt-1">{adherence.subtitle || adherence.reason}</p>
							</>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				<Card className="lg:col-span-2 shadow-sm border-border">
					<CardHeader>
						<CardTitle className="text-lg font-semibold text-foreground">Vital Status Trend (Systolic BP)</CardTitle>
					</CardHeader>
					<CardContent>
						{chartData.length === 0 ? (
							<p className="text-sm text-muted-foreground py-12 text-center">
								No blood pressure history yet. Enter readings in onboarding or add vitals over time.
							</p>
						) : (
							<div className="h-[300px] w-full">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={chartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
										<XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
										<YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
										<Tooltip
											contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
											itemStyle={{ color: 'hsl(var(--foreground))' }}
										/>
										<Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
									</LineChart>
								</ResponsiveContainer>
							</div>
						)}
					</CardContent>
				</Card>

				<div className="space-y-6">
					<Card className="shadow-sm border-border">
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold text-foreground flex items-center">
								<AlertCircle className="w-4 h-4 mr-2 text-accent" /> Preventive care reminders
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{gaps.length === 0 ? (
								<p className="text-sm text-muted-foreground">No reminders at this time.</p>
							) : (
								gaps.map((g) => (
									<div key={g.id} className="flex justify-between items-start gap-2">
										<div>
											<span className="text-sm text-foreground block">{g.label}</span>
											{g.detail ? <span className="text-xs text-muted-foreground">{g.detail}</span> : null}
										</div>
										<Badge variant="outline" className="text-accent border-accent shrink-0">
											{g.status === 'overdue' ? 'Overdue' : g.status === 'scheduled' ? 'Scheduled' : 'Due'}
										</Badge>
									</div>
								))
							)}
							<Button variant="link" className="w-full text-primary p-0 h-auto justify-start mt-2" type="button" disabled>
								Discuss screening with your GP <ArrowRight className="w-4 h-4 ml-1" />
							</Button>
						</CardContent>
					</Card>

					<Card className="shadow-sm border-border">
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold text-foreground flex items-center">
								<Calendar className="w-4 h-4 mr-2 text-primary" /> Upcoming appointments
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								No appointments synced yet. Use Appointments in the menu when booking is enabled.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
