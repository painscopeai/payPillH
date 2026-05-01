import { Router } from 'express';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import logger from '../../utils/logger.js';
import { twelveMonthTrend, pct } from './helpers.js';

const router = Router();

const emptyFinancial = () => ({
	kpis: {},
	trends: [],
	breakdown: {},
});

async function loadPatientsWithProfiles(client) {
	const { data: plist, error: pe } = await client.from('patients').select('id, user_id, created_at');
	if (pe) throw pe;
	const list = plist || [];
	const userIds = [...new Set(list.map((p) => p.user_id).filter(Boolean))];
	let profById = {};
	if (userIds.length) {
		const { data: profiles, error: fe } = await client.from('profiles').select('id, date_of_birth, onboarding_status, onboarding_completed').in('id', userIds);
		if (fe) throw fe;
		profById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
	}
	return { list, profById };
}

router.get('/patients', async (req, res) => {
	try {
		const { list: patients, profById } = await loadPatientsWithProfiles(supabaseAdmin);
		const { count: individualProfileCount, error: pce } = await supabaseAdmin
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('role', 'individual');
		if (pce) throw pce;
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const totalPatients = Math.max(patients.length, individualProfileCount ?? 0);
		const newThisMonth = patients.filter((p) => new Date(p.created_at) >= thirtyDaysAgo).length;
		const patientUserIds = new Set(patients.map((p) => p.user_id).filter(Boolean));

		let patientsWithApps = 0;
		const { data: appts } = await supabaseAdmin.from('appointments').select('user_id');
		if (appts?.length) {
			const uniq = new Set(appts.map((a) => a.user_id).filter((id) => patientUserIds.has(id)));
			patientsWithApps = uniq.size;
		}

		const genderBreakdown = { Unknown: totalPatients };
		const ageGroups = { '18-30': 0, '31-45': 0, '46-60': 0, '60+': 0, Unknown: 0 };
		let inactivePatients = 0;
		for (const p of patients) {
			const pr = profById[p.user_id];
			if (pr?.onboarding_completed !== true) inactivePatients++;

			const dob = pr?.date_of_birth ? new Date(pr.date_of_birth) : null;
			if (!dob || Number.isNaN(dob.getTime())) {
				ageGroups.Unknown++;
				continue;
			}
			const age = new Date().getFullYear() - dob.getFullYear();
			if (age <= 30) ageGroups['18-30']++;
			else if (age <= 45) ageGroups['31-45']++;
			else if (age <= 60) ageGroups['46-60']++;
			else ageGroups['60+']++;
		}

		const completedCount = patients.filter((p) => profById[p.user_id]?.onboarding_completed === true).length;
		const activePatients = completedCount > 0 ? completedCount : totalPatients;
		const churnRate = pct(inactivePatients, totalPatients);
		const retentionRate = pct(patientsWithApps, totalPatients);

		logger.info('[admin-analytics] patients');

		res.json({
			kpis: {
				total_patients: totalPatients,
				active_patients: activePatients,
				new_this_month: newThisMonth,
				churn_rate: churnRate,
				retention_rate: retentionRate,
				form_completion_rate: 0,
				ai_adoption_rate: 0,
				avg_satisfaction_score: 0,
			},
			trends: twelveMonthTrend(patients),
			breakdown: {
				by_gender: genderBreakdown,
				by_age_group: ageGroups,
				by_appointment_type: {},
				top_conditions: [],
			},
		});
	} catch (e) {
		logger.error(`[admin-analytics/patients] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/employers', async (req, res) => {
	try {
		const { data: employers, error } = await supabaseAdmin.from('employers').select('id, created_at, payload');
		if (error) throw error;
		const rows = employers || [];
		const totalEmployers = rows.length;
		const activeEmployers = rows.filter((e) => (e.payload?.status ?? 'active') === 'active').length;

		const empIds = rows.map((e) => e.id);
		let totalEmployees = 0;
		const byEmployer = {};
		if (empIds.length) {
			const { data: ees } = await supabaseAdmin.from('employer_employees').select('employer_id');
			for (const row of ees || []) {
				byEmployer[row.employer_id] = (byEmployer[row.employer_id] || 0) + 1;
			}
			totalEmployees = (ees || []).length;
		}

		const topEmployers = rows
			.map((e) => ({
				name: e.payload?.company_name || e.payload?.name || 'Employer',
				employee_count: byEmployer[e.id] || 0,
				status: e.payload?.status ?? 'active',
			}))
			.sort((a, b) => b.employee_count - a.employee_count)
			.slice(0, 5);

		res.json({
			kpis: {
				total_employers: totalEmployers,
				active_employers: activeEmployers,
				total_employees: totalEmployees,
				mrr_from_employers: 0,
				avg_employee_engagement: 0,
				form_completion_rate: 0,
			},
			trends: twelveMonthTrend(rows),
			breakdown: {
				by_subscription_status: {},
				top_employers: topEmployers,
			},
		});
	} catch (e) {
		logger.error(`[admin-analytics/employers] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/insurance', async (req, res) => {
	try {
		const { count: partners } = await supabaseAdmin.from('insurance_companies').select('*', { count: 'exact', head: true });
		const { data: claims } = await supabaseAdmin.from('insurance_claims').select('id, status, created_at');
		const claimRows = claims || [];
		const totalClaims = claimRows.length;
		const approved = claimRows.filter((c) => (c.status || '').toLowerCase() === 'approved').length;
		const approvalRate = pct(approved, totalClaims);

		res.json({
			kpis: {
				total_partners: partners ?? 0,
				total_claims: totalClaims,
				approval_rate: approvalRate,
				avg_processing_time: 0,
			},
			trends: twelveMonthTrend(claimRows),
			breakdown: {},
		});
	} catch (e) {
		logger.error(`[admin-analytics/insurance] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/providers', async (req, res) => {
	try {
		const { data: providers, error } = await supabaseAdmin.from('providers').select('id, user_id, created_at');
		if (error) throw error;
		const rows = providers || [];
		const { count: apptCount } = await supabaseAdmin.from('appointments').select('*', { count: 'exact', head: true });

		res.json({
			kpis: {
				total_providers: rows.length,
				active_providers: rows.length,
				total_appointments: apptCount ?? 0,
				avg_rating: 0,
			},
			trends: twelveMonthTrend(rows),
			breakdown: {},
		});
	} catch (e) {
		logger.error(`[admin-analytics/providers] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/subscriptions', (req, res) => {
	res.json({
		kpis: {
			active_subscriptions: 0,
			mrr: 0,
			arr: 0,
			churn_rate: 0,
		},
		trends: twelveMonthTrend([]),
		breakdown: { by_status: {} },
	});
});

router.get('/financial', (req, res) => {
	res.json(emptyFinancial());
});

router.get('/ai', async (req, res) => {
	try {
		const { data: msgs } = await supabaseAdmin.from('integrated_ai_messages').select('id, created_at');
		const rows = msgs || [];
		res.json({
			kpis: {
				total_requests: rows.length,
				success_rate: 0,
				avg_processing_time: 0,
				total_cost: 0,
			},
			trends: twelveMonthTrend(rows),
		});
	} catch (e) {
		logger.error(`[admin-analytics/ai] ${e.message}`);
		res.status(500).json({ error: e.message });
	}
});

router.get('/forms', (req, res) => {
	res.json({
		kpis: {},
		trends: twelveMonthTrend([]),
	});
});

export default router;
