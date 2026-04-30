
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Loader2, AlertCircle } from 'lucide-react';

export default function ProviderOnboardingPage() {
  const { currentAdmin } = useAdminAuth();

  const [formData, setFormData] = useState({
    name: '', category: 'Clinic', email: '', phone: '', status: 'pending'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchUserId, setSearchUserId] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  const [forms, setForms] = useState([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  const fetchOnboardingProgress = async () => {
    setIsLoadingProgress(true);
    try {
      const res = await apiServerClient.fetch('/onboarding/progress');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Authentication failed: Please log in again to view progress.');
        }
        throw new Error(errData.error || 'Failed to fetch onboarding progress.');
      }

      const data = await res.json();
      setOnboardingProgress(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingProgress(false);
    }
  };

  const fetchFormsList = async () => {
    setIsLoadingForms(true);
    try {
      const res = await apiServerClient.fetch('/admin/forms?limit=50');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load forms list.');
      }
      setForms(data.items || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingForms(false);
    }
  };

  const handleCreateForm = async () => {
    setIsCreatingForm(true);
    try {
      const payload = {
        name: 'New Provider Evaluation',
        category: 'provider',
        created_by: currentAdmin?.id || 'admin'
      };

      const res = await apiServerClient.fetch('/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Form creation is not configured on the API yet.');
      }

      toast.success('Form created successfully!');
      fetchFormsList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCreatingForm(false);
    }
  };

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchUserId.trim()) return;

    setIsLoadingProfile(true);
    setUserProfile(null);
    try {
      const res = await apiServerClient.fetch(`/admin/profile/${searchUserId.trim()}`);
      if (res.status === 404) {
        toast.error('User profile not found');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load profile');
      }
      const record = await res.json();
      setUserProfile(record);
      toast.success('User profile loaded successfully');
    } catch (err) {
      toast.error(err.message || 'An error occurred while fetching the user profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchOnboardingProgress();
    fetchFormsList();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiServerClient.fetch('/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.name,
          specialty: formData.category,
        }),
      });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errBody.error || 'Failed to onboard provider');
      toast.success('Provider onboarded successfully');
      setFormData({ name: '', category: 'Clinic', email: '', phone: '', status: 'pending' });
    } catch (err) {
      toast.error(err.message || 'Failed to onboard provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Provider Onboarding</h1>
        <p className="text-muted-foreground">Manage provider profiles, forms, and onboarding progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">User Profile Lookup</CardTitle>
            <CardDescription>Search for a profile by Supabase user id (UUID)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchUser} className="flex gap-2">
              <Input 
                placeholder="Enter User ID..." 
                value={searchUserId} 
                onChange={(e) => setSearchUserId(e.target.value)} 
                className="bg-background"
              />
              <Button type="submit" disabled={isLoadingProfile} variant="secondary">
                {isLoadingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </form>
            {userProfile && (
              <div className="mt-4 p-3 bg-muted rounded-md text-sm border border-border">
                <p><strong>Name:</strong> {userProfile.name || 'N/A'}</p>
                <p><strong>Email:</strong> {userProfile.email}</p>
                <p><strong>Role:</strong> {userProfile.role || 'N/A'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Onboarding Progress</CardTitle>
            <CardDescription>Progress for your current signed-in admin session</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={fetchOnboardingProgress} 
              disabled={isLoadingProgress}
              variant="outline" 
              className="w-full mb-4"
            >
              {isLoadingProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isLoadingProgress ? 'Loading...' : 'Refresh Progress'}
            </Button>
            {onboardingProgress ? (
              <div className="text-sm bg-muted p-3 rounded-md border border-border">
                <p><strong>Current Step:</strong> {String(onboardingProgress.currentStep ?? '—')}</p>
                <p><strong>Completed:</strong> {onboardingProgress.completedSteps?.length || 0} steps</p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4" /> No progress data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Forms Management</CardTitle>
            <CardDescription>Available onboarding forms (admin API)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchFormsList} disabled={isLoadingForms} variant="outline" size="sm">
              Refresh
            </Button>
            <Button onClick={handleCreateForm} disabled={isCreatingForm} size="sm" className="gap-2 bg-primary text-primary-foreground">
              {isCreatingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              New Form
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {forms.length > 0 ? (
            <div className="space-y-2">
              {forms.map((form) => (
                <div key={form.id} className="flex justify-between items-center p-3 border border-border rounded-md bg-card">
                  <span className="font-medium text-sm">{form.name}</span>
                  <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-1 rounded-full">{form.category}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No forms found.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Manual Provider Entry</CardTitle>
          <CardDescription>Create a provider row in Supabase (display name / specialty).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider Name</Label>
                <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hospital">Hospital</SelectItem>
                    <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="Clinic">Clinic</SelectItem>
                    <SelectItem value="Specialist">Specialist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-muted-foreground">Optional contact fields below are stored when provider auth linkage exists; this quick-add uses name and category only.</p>
              </div>
              <div className="space-y-2">
                <Label>Email (informational)</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Phone (informational)</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-background" />
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground">
              {isSubmitting ? 'Saving...' : 'Save Provider Record'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
