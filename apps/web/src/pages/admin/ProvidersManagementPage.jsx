
import React, { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { formatAdminApiFailure, formatAdminNetworkError } from '@/lib/adminApiErrors.js';
import AdminFetchErrorBanner from '@/components/admin/AdminFetchErrorBanner.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/admin/DataTable.jsx';
import { SearchBar } from '@/components/admin/SearchBar.jsx';
import { StatusBadge } from '@/components/admin/StatusBadge.jsx';
import { toast } from 'sonner';

export default function ProvidersManagementPage() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setFetchError('');
      const q = new URLSearchParams({ page: String(page), perPage: '20' });
      if (searchTerm.trim()) q.set('search', searchTerm.trim());
      const path = `/admin/providers?${q}`;
      try {
        const res = await apiServerClient.fetch(path);
        if (!res.ok) {
          setFetchError(await formatAdminApiFailure(res, { path }));
          return;
        }
        const result = await res.json();
        setData(result.items || []);
        setTotalPages(Math.max(1, result.totalPages || 1));
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
  }, [searchTerm, page]);

  const columns = [
    { key: 'name', label: 'Provider Name' },
    { key: 'category', label: 'Category' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'verification_status', label: 'Verification', render: (r) => <StatusBadge status={r.verification_status} /> }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Provider Management</h1>
        <p className="text-muted-foreground">Approve and manage marketplace providers.</p>
      </div>
      <AdminFetchErrorBanner message={fetchError} />
      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border bg-muted/20">
            <SearchBar placeholder="Search providers..." onSearch={setSearchTerm} className="max-w-md" />
          </div>
          <div className="p-4">
            <DataTable columns={columns} data={data} isLoading={isLoading} page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
