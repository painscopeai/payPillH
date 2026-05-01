
import React, { useState, useEffect } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { formatAdminApiFailure, formatAdminNetworkError } from '@/lib/adminApiErrors.js';
import AdminFetchErrorBanner from '@/components/admin/AdminFetchErrorBanner.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/admin/DataTable.jsx';
import { SearchBar } from '@/components/admin/SearchBar.jsx';
import { FilterPanel } from '@/components/admin/FilterPanel.jsx';
import { StatusBadge } from '@/components/admin/StatusBadge.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TransactionsManagementPage() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetchError, setFetchError] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError('');
    const q = new URLSearchParams({ page: String(page), perPage: '15' });
    const path = `/admin/transactions?${q}`;
    try {
      const res = await apiServerClient.fetch(path);
      if (!res.ok) {
        setFetchError(await formatAdminApiFailure(res, { path }));
        return;
      }
      const result = await res.json();
      let items = result.items || [];
      if (searchTerm.trim()) {
        const t = searchTerm.trim().toLowerCase();
        items = items.filter((r) => (r.id || '').toLowerCase().includes(t));
      }
      if (typeFilter !== 'all') items = items.filter((r) => r.transaction_type === typeFilter);
      setData(items);
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
  }, [searchTerm, typeFilter, page]);

  const columns = [
    { key: 'id', label: 'TXN ID', render: (r) => <span className="font-mono text-xs">{(r.id || '').toString().slice(0, 8) || '—'}</span> },
    { key: 'transaction_type', label: 'Type', render: (r) => <span className="capitalize">{(r.transaction_type || '—').replace('_', ' ')}</span> },
    { key: 'user_type', label: 'User Role' },
    { 
      key: 'amount', 
      label: 'Amount', 
      render: (r) => <span className="font-medium font-mono">${(r.amount || 0).toFixed(2)}</span>
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: (row) => <StatusBadge status={row.status} />
    },
    { 
      key: 'created', 
      label: 'Date', 
      render: (row) => format(new Date(row.created), 'MMM d, yyyy HH:mm')
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display">Transactions</h1>
          <p className="text-muted-foreground">View and manage all system transactions.</p>
        </div>
      </div>

      <AdminFetchErrorBanner message={fetchError} />

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border flex gap-4 bg-muted/20 items-center">
            <SearchBar placeholder="Search TXN ID..." onSearch={setSearchTerm} className="flex-1 max-w-sm" />
            <FilterPanel activeFiltersCount={typeFilter !== 'all' ? 1 : 0} onReset={() => setTypeFilter('all')}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="subscription_payment">Subscription Payment</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="medication_order">Medication Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FilterPanel>
          </div>
          <div className="p-4">
            <DataTable columns={columns} data={data} isLoading={isLoading} page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
