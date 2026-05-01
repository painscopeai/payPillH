
import React, { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Building2, ShieldCheck, Activity,
  CreditCard, DollarSign, TrendingUp,
  RefreshCw, Download, CheckCircle2, Clock
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))'];

/** Sample chart only — no live billing pipeline wired yet. */
const SAMPLE_REVENUE_DATA = [
  { name: 'Jan', revenue: 4000 }, { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 5000 }, { name: 'Apr', revenue: 4500 },
  { name: 'May', revenue: 6000 }, { name: 'Jun', revenue: 5500 },
];

async function parseFailedResponse(res) {
  let detail = `Request failed (${res.status})`;
  try {
    const text = await res.text();
    if (!text?.trim()) return detail;
    try {
      const j = JSON.parse(text);
      return j.error || j.message || text;
    } catch {
      return text;
    }
  } catch {
    return detail;
  }
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('30');
  const [refreshTick, setRefreshTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [stats, setStats] = useState({
    patients: 0, employers: 0, insurance: 0, providers: 0,
    transactions: 0, subscriptions: 0, mrr: 0, arr: 0
  });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setIsLoading(true);
      setFetchError('');
      try {
        // #region agent log
        fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'AdminDashboard.jsx:loadSummary',message:'summary_fetch_start',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        const res = await apiServerClient.fetch('/admin/summary');
        if (!res.ok) {
          const msg = await parseFailedResponse(res);
          throw new Error(msg);
        }
        const body = await res.json();
        if (cancelled) return;
        setStats(body.stats || {});
        setActivities(body.recentActivities || []);
        // #region agent log
        fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'AdminDashboard.jsx:loadSummary',message:'summary_fetch_ok',data:{patients:body.stats?.patients},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        if (cancelled) return;
        if (error?.name === 'AbortError') return;
        const msg = error?.message || 'Could not load dashboard data. Ensure the API is deployed at /api and your admin session is valid.';
        console.error('Failed to fetch dashboard data:', error);
        setFetchError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [dateRange, refreshTick]);

  const userGrowthData = [
    { name: 'Week 1', patients: Math.max(0, Math.round(stats.patients * 0.4)), employers: Math.max(0, Math.round(stats.employers * 0.4)), insurance: Math.max(0, Math.round(stats.insurance * 0.4)) },
    { name: 'Week 2', patients: Math.max(0, Math.round(stats.patients * 0.55)), employers: Math.max(0, Math.round(stats.employers * 0.55)), insurance: Math.max(0, Math.round(stats.insurance * 0.55)) },
    { name: 'Week 3', patients: Math.max(0, Math.round(stats.patients * 0.75)), employers: Math.max(0, Math.round(stats.employers * 0.75)), insurance: Math.max(0, Math.round(stats.insurance * 0.75)) },
    { name: 'Week 4', patients: stats.patients || 0, employers: stats.employers || 0, insurance: stats.insurance || 0 },
  ];

  const subscriptionData = [
    { name: 'Active', value: stats.subscriptions || 0 },
    { name: 'Paused', value: 0 },
    { name: 'Expired', value: 0 },
  ];

  const KpiCard = ({ title, value, icon: Icon, isCurrency }) => (
    <Card className="admin-card-shadow border-none">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-muted-foreground text-sm font-medium mb-1">{title}</h3>
        <div className="text-3xl font-bold font-display">
          {isCurrency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : Number(value ?? 0).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">Welcome back. Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setRefreshTick((t) => t + 1)} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button className="bg-primary-gradient">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong className="font-semibold">Could not load summary.</strong>{' '}
          {fetchError}
          {' '}Check that <code className="rounded bg-muted px-1 py-0.5 text-foreground">GET /api/admin/summary</code> returns 200 (API deployed,{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">VITE_API_BASE_URL</code> if non-default).
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total Patients" value={stats.patients} icon={Users} />
        <KpiCard title="Employers" value={stats.employers} icon={Building2} />
        <KpiCard title="Insurance Users" value={stats.insurance} icon={ShieldCheck} />
        <KpiCard title="Providers" value={stats.providers} icon={Activity} />
        <KpiCard title="Transactions" value={stats.transactions} icon={CreditCard} />
        <KpiCard title="Active Subscriptions" value={stats.subscriptions} icon={CheckCircle2} />
        <KpiCard title="Monthly Recurring (MRR)" value={stats.mrr} icon={DollarSign} isCurrency />
        <KpiCard title="Annual Run Rate (ARR)" value={stats.arr} icon={TrendingUp} isCurrency />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="admin-card-shadow border-none">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend</CardTitle>
            <CardDescription>
              Illustrative sample only — live revenue requires billing data wired to this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SAMPLE_REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `$${val}`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="admin-card-shadow border-none">
          <CardHeader>
            <CardTitle className="text-lg">User Growth</CardTitle>
            <CardDescription>
              Approximate weekly breakdown from current totals — not a historical time series.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="patients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="employers" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="admin-card-shadow border-none">
          <CardHeader>
            <CardTitle className="text-lg">Subscription Status</CardTitle>
            <CardDescription>From summary counts — pause/expiry breakdown when subscription billing exists.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="admin-card-shadow border-none flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activities</CardTitle>
            <CardDescription>Latest rows from audit_logs (when populated).</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2 space-y-4">
            {activities.length > 0 ? activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{activity.action} {activity.resource_type}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(activity.created), 'MMM d, h:mm a')} — {activity.user_id ? String(activity.user_id).slice(0, 8) : 'system'}</p>
                </div>
              </div>
            )) : (
              <div className="text-center text-muted-foreground py-8">No recent activities</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
