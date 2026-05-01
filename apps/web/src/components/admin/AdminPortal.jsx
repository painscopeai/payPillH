import React, { Suspense } from 'react';
import { Route, Routes, Outlet, Navigate } from 'react-router-dom';
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

function AdminComingSoon() {
	return <div className="p-8 text-center text-muted-foreground">Module coming soon</div>;
}

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

/**
 * Mounted at `/admin/*` from App. Uses `basename="/admin"` so child paths are stable under the
 * parent splat route (avoids catch‑all shadowing concrete routes).
 */
export default function AdminPortal() {
	return (
		<Routes basename="/admin">
			<Route index element={<AdminLandingPage />} />
			<Route path="login" element={<AdminLoginPage />} />
			<Route path="form-responses" element={<Navigate to="/admin/forms" replace />} />

			<Route element={<AdminProtectedOutlet />}>
				<Route path="dashboard" element={<AdminDashboard />} />

				<Route path="analytics/patients" element={<PatientsAnalyticsPage />} />
				<Route path="analytics/employers" element={<EmployersAnalyticsPage />} />
				<Route path="analytics/insurance" element={<InsuranceAnalyticsPage />} />
				<Route path="analytics/providers" element={<ProvidersAnalyticsPage />} />
				<Route path="analytics/subscriptions" element={<SubscriptionsAnalyticsPage />} />
				<Route path="analytics/financial" element={<FinancialAnalyticsPage />} />
				<Route path="analytics/ai" element={<AIAnalyticsPage />} />
				<Route path="analytics/forms" element={<FormsAnalyticsPage />} />

				<Route path="patients" element={<PatientsManagementPage />} />
				<Route path="employers" element={<EmployersManagementPage />} />
				<Route path="insurance-users" element={<InsuranceUsersManagementPage />} />
				<Route path="transactions" element={<TransactionsManagementPage />} />
				<Route path="subscription-plans" element={<SubscriptionPlansPage />} />
				<Route path="subscription-assignment" element={<SubscriptionAssignmentPage />} />
				<Route path="subscription-monitoring" element={<SubscriptionMonitoringPage />} />
				<Route path="subscription-logs" element={<SubscriptionLogsPage />} />
				<Route path="providers" element={<ProvidersManagementPage />} />
				<Route path="provider-onboarding" element={<ProviderOnboardingPage />} />
				<Route path="bulk-provider-upload" element={<BulkProviderUploadPage />} />

				<Route path="forms/:formId/responses" element={<FormResponsesPage />} />
				<Route path="forms" element={<FormBuilderPageLazy />} />

				<Route path="knowledge-base" element={<KnowledgeBasePage />} />
				<Route path="ai-logs" element={<AILogsPage />} />
				<Route path="settings" element={<SystemSettingsPage />} />

				<Route path="*" element={<AdminComingSoon />} />
			</Route>
		</Routes>
	);
}
