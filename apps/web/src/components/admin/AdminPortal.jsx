import React, { Suspense } from 'react';
import { Route, Routes, Outlet } from 'react-router-dom';
import ProtectedAdminRoute from '@/components/admin/ProtectedAdminRoute.jsx';
import AdminLayout from '@/components/admin/AdminLayout.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import AdminLandingPage from '@/pages/admin/AdminLandingPage.jsx';
import AdminLoginPage from '@/pages/admin/AdminLoginPage.jsx';
import AdminDashboard from '@/pages/admin/AdminDashboard.jsx';

const PatientsAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/PatientsAnalyticsPage.jsx'));
const EmployersAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/EmployersAnalyticsPage.jsx'));
const InsuranceAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/InsuranceAnalyticsPage.jsx'));
const ProvidersAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/ProvidersAnalyticsPage.jsx'));
const SubscriptionsAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/SubscriptionsAnalyticsPage.jsx'));
const FinancialAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/FinancialAnalyticsPage.jsx'));
const AIAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/AIAnalyticsPage.jsx'));
const FormsAnalyticsPage = React.lazy(() => import('@/pages/admin/analytics/FormsAnalyticsPage.jsx'));

const PatientsManagementPage = React.lazy(() => import('@/pages/admin/PatientsManagementPage.jsx'));
const EmployersManagementPage = React.lazy(() => import('@/pages/admin/EmployersManagementPage.jsx'));
const InsuranceUsersManagementPage = React.lazy(() => import('@/pages/admin/InsuranceUsersManagementPage.jsx'));
const TransactionsManagementPage = React.lazy(() => import('@/pages/admin/TransactionsManagementPage.jsx'));
const SubscriptionPlansPage = React.lazy(() => import('@/pages/admin/SubscriptionPlansPage.jsx'));
const SubscriptionAssignmentPage = React.lazy(() => import('@/pages/admin/SubscriptionAssignmentPage.jsx'));
const SubscriptionMonitoringPage = React.lazy(() => import('@/pages/admin/SubscriptionMonitoringPage.jsx'));
const SubscriptionLogsPage = React.lazy(() => import('@/pages/admin/SubscriptionLogsPage.jsx'));
const ProvidersManagementPage = React.lazy(() => import('@/pages/admin/ProvidersManagementPage.jsx'));
const ProviderOnboardingPage = React.lazy(() => import('@/pages/admin/ProviderOnboardingPage.jsx'));
const BulkProviderUploadPage = React.lazy(() => import('@/pages/admin/BulkProviderUploadPage.jsx'));
const FormBuilderPageLazy = React.lazy(() => import('@/pages/admin/FormBuilderPage.jsx'));
const FormResponsesPage = React.lazy(() => import('@/pages/admin/FormResponsesPage.jsx'));
const KnowledgeBasePage = React.lazy(() => import('@/pages/admin/KnowledgeBasePage.jsx'));
const AILogsPage = React.lazy(() => import('@/pages/admin/AILogsPage.jsx'));
const SystemSettingsPage = React.lazy(() => import('@/pages/admin/SystemSettingsPage.jsx'));

const adminSuspenseFallback = (
	<div className="flex min-h-[50vh] items-center justify-center">
		<LoadingSpinner size="lg" />
	</div>
);

function AdminProtectedOutlet() {
	return (
		<ProtectedAdminRoute>
			<AdminLayout>
				<Suspense fallback={adminSuspenseFallback}>
					<Outlet />
				</Suspense>
			</AdminLayout>
		</ProtectedAdminRoute>
	);
}

/** Mounted at `/admin/*` — use absolute paths so matching works inside the splat route. */
export default function AdminPortal() {
	return (
		<Routes>
			<Route path="/admin" element={<AdminLandingPage />} />
			<Route path="/admin/login" element={<AdminLoginPage />} />
			<Route element={<AdminProtectedOutlet />}>
				<Route path="/admin/dashboard" element={<AdminDashboard />} />

				<Route path="/admin/analytics/patients" element={<PatientsAnalyticsPage />} />
				<Route path="/admin/analytics/employers" element={<EmployersAnalyticsPage />} />
				<Route path="/admin/analytics/insurance" element={<InsuranceAnalyticsPage />} />
				<Route path="/admin/analytics/providers" element={<ProvidersAnalyticsPage />} />
				<Route path="/admin/analytics/subscriptions" element={<SubscriptionsAnalyticsPage />} />
				<Route path="/admin/analytics/financial" element={<FinancialAnalyticsPage />} />
				<Route path="/admin/analytics/ai" element={<AIAnalyticsPage />} />
				<Route path="/admin/analytics/forms" element={<FormsAnalyticsPage />} />

				<Route path="/admin/patients" element={<PatientsManagementPage />} />
				<Route path="/admin/employers" element={<EmployersManagementPage />} />
				<Route path="/admin/insurance-users" element={<InsuranceUsersManagementPage />} />
				<Route path="/admin/transactions" element={<TransactionsManagementPage />} />
				<Route path="/admin/subscription-plans" element={<SubscriptionPlansPage />} />
				<Route path="/admin/subscription-assignment" element={<SubscriptionAssignmentPage />} />
				<Route path="/admin/subscription-monitoring" element={<SubscriptionMonitoringPage />} />
				<Route path="/admin/subscription-logs" element={<SubscriptionLogsPage />} />
				<Route path="/admin/providers" element={<ProvidersManagementPage />} />
				<Route path="/admin/provider-onboarding" element={<ProviderOnboardingPage />} />
				<Route path="/admin/bulk-provider-upload" element={<BulkProviderUploadPage />} />

				<Route path="/admin/forms/:formId/responses" element={<FormResponsesPage />} />
				<Route path="/admin/forms" element={<FormBuilderPageLazy />} />

				<Route path="/admin/knowledge-base" element={<KnowledgeBasePage />} />
				<Route path="/admin/ai-logs" element={<AILogsPage />} />
				<Route path="/admin/settings" element={<SystemSettingsPage />} />

				<Route path="*" element={<div className="p-8 text-center text-muted-foreground">Module coming soon</div>} />
			</Route>
		</Routes>
	);
}
