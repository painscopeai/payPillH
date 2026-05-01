
import React, { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { formatAdminApiFailure, formatAdminNetworkError } from '@/lib/adminApiErrors.js';
import AdminFetchErrorBanner from '@/components/admin/AdminFetchErrorBanner.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/admin/DataTable.jsx';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function SubscriptionLogsPage() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setFetchError('');
      const path = '/admin/subscription-logs?page=1&perPage=20';
      try {
        const res = await apiServerClient.fetch(path);
        if (!res.ok) {
          setFetchError(await formatAdminApiFailure(res, { path }));
          return;
        }
        const result = await res.json();
        setData(result.items || []);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        const msg = error?.message || formatAdminNetworkError(error, { path });
        setFetchError(msg);
        toast.error(msg.split('\n')[0]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const columns = [
    { key: 'created', label: 'Timestamp', render: (r) => format(new Date(r.created), 'MMM d, yyyy HH:mm:ss') },
    { key: 'action', label: 'Action', render: (r) => <span className="font-medium">{r.action}</span> },
    { key: 'subscription_id', label: 'Sub ID', render: (r) => <span className="font-mono text-xs">{(r.subscription_id || '').toString().slice(0, 8) || '—'}</span> },
    { key: 'reason', label: 'Reason' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Subscription Logs</h1>
        <p className="text-muted-foreground">Audit trail for all subscription changes.</p>
      </div>
      <AdminFetchErrorBanner message={fetchError} />
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <DataTable columns={columns} data={data} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
