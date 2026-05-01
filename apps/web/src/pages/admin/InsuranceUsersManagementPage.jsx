
import React, { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { formatAdminApiFailure, formatAdminNetworkError } from '@/lib/adminApiErrors.js';
import AdminFetchErrorBanner from '@/components/admin/AdminFetchErrorBanner.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/admin/DataTable.jsx';
import { SearchBar } from '@/components/admin/SearchBar.jsx';
import { ExportButton } from '@/components/admin/ExportButton.jsx';
import { StatusBadge } from '@/components/admin/StatusBadge.jsx';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function InsuranceUsersManagementPage() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError('');
    const q = new URLSearchParams({ page: String(page), perPage: '10' });
    if (searchTerm.trim()) q.set('search', searchTerm.trim());
    const path = `/admin/insurance-companies?${q}`;
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

  useEffect(() => {
    fetchData();
  }, [searchTerm, page]);

  const columns = [
    { key: 'name', label: 'Company Name', sortable: true },
    { key: 'license_number', label: 'License', sortable: false },
    { 
      key: 'status', 
      label: 'Status', 
      render: (row) => <StatusBadge status={row.status || 'active'} />
    },
    { 
      key: 'created', 
      label: 'Registered', 
      render: (row) => format(new Date(row.created), 'MMM d, yyyy')
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Insurance Management</h1>
          <p className="text-muted-foreground">Manage insurance providers and contracts.</p>
        </div>
        <ExportButton data={data} filename="insurance_providers" />
      </div>

      <AdminFetchErrorBanner message={fetchError} />

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border bg-muted/20">
            <SearchBar 
              placeholder="Search insurance companies..." 
              onSearch={setSearchTerm} 
              className="max-w-md" 
            />
          </div>
          <div className="p-4">
            <DataTable 
              columns={columns} 
              data={data} 
              isLoading={isLoading} 
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
