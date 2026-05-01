import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { ensurePatientForUser } from '../lib/ensurePatient.js';
import logger from '../utils/logger.js';

const router = Router();

function generateCSV(data) {
	if (!Array.isArray(data) || data.length === 0) {
		return '';
	}

	const headers = Object.keys(data[0]);

	const escapeCSVValue = (value) => {
		if (value === null || value === undefined) {
			return '';
		}

		const stringValue = String(value);

		if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}

		return stringValue;
	};

	const headerRow = headers.map(escapeCSVValue).join(',');

	const dataRows = data.map((row) =>
		headers.map((header) => escapeCSVValue(row[header])).join(',')
	);

	return [headerRow, ...dataRows].join('\n');
}

/**
 * GET /data/export
 */
router.get('/export', async (req, res) => {
	const { userId, exportType } = req.query;

	if (!userId) {
		return res.status(400).json({
			error: 'Missing required query parameter: userId',
		});
	}

	const validExportTypes = ['all', 'health-records', 'medications', 'appointments', 'lab-results', 'wellness-activities'];
	const type = exportType || 'all';

	if (!validExportTypes.includes(type)) {
		return res.status(400).json({
			error: `Invalid exportType. Must be one of: ${validExportTypes.join(', ')}`,
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
	if (!profile) {
		return res.status(400).json({
			error: 'User not found',
		});
	}

	if (type === 'all') {
		const allData = await fetchAllUserData(userId);
		const filename = `health-export-${userId}-${Date.now()}.json`;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		res.json(allData);
	} else if (type === 'health-records') {
		await exportHealthRecordsAsPDF(userId, res);
	} else if (type === 'lab-results') {
		await exportLabResultsAsPDF(userId, res);
	} else if (type === 'medications') {
		await exportMedicationsAsCSV(userId, res);
	} else if (type === 'appointments') {
		await exportAppointmentsAsCSV(userId, res);
	} else if (type === 'wellness-activities') {
		await exportWellnessActivitiesAsCSV(userId, res);
	}
});

async function fetchAllUserData(userId) {
	const data = {
		user: null,
		healthProfile: null,
		medications: [],
		appointments: [],
		labResults: [],
		wellnessActivities: [],
		healthGoals: [],
		recommendations: [],
	};

	if (!supabaseAdmin) return data;

	try {
		const { data: prof } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();
		data.user = prof;
	} catch (error) {
		logger.warn(`Failed to fetch user: ${error.message}`);
	}

	try {
		const { data: hp } = await supabaseAdmin.from('health_profile').select('*').eq('user_id', userId).maybeSingle();
		data.healthProfile = hp;
	} catch (error) {
		logger.warn(`Failed to fetch health profile: ${error.message}`);
	}

	try {
		const { data: meds } = await supabaseAdmin.from('prescriptions').select('*').eq('user_id', userId);
		data.medications = meds || [];
	} catch (error) {
		logger.warn(`Failed to fetch medications: ${error.message}`);
	}

	try {
		const { data: appts } = await supabaseAdmin.from('appointments').select('*').eq('user_id', userId);
		data.appointments = appts || [];
	} catch (error) {
		logger.warn(`Failed to fetch appointments: ${error.message}`);
	}

	try {
		const { data: labs } = await supabaseAdmin.from('lab_results').select('*').eq('user_id', userId);
		data.labResults = labs || [];
	} catch (error) {
		logger.warn(`Failed to fetch lab results: ${error.message}`);
	}

	try {
		const { data: act } = await supabaseAdmin.from('wellness_activities').select('*').eq('user_id', userId);
		data.wellnessActivities = act || [];
	} catch (error) {
		logger.warn(`Failed to fetch wellness activities: ${error.message}`);
	}

	try {
		const { data: goals } = await supabaseAdmin.from('health_goals').select('*').eq('user_id', userId);
		data.healthGoals = goals || [];
	} catch (error) {
		logger.warn(`Failed to fetch health goals: ${error.message}`);
	}

	try {
		const pid = await ensurePatientForUser(userId);
		const { data: recs } = await supabaseAdmin.from('patient_recommendations').select('*').eq('patient_id', pid);
		data.recommendations = recs || [];
	} catch (error) {
		logger.warn(`Failed to fetch recommendations: ${error.message}`);
	}

	return data;
}

async function exportHealthRecordsAsPDF(userId, res) {
	const { default: PDFDocument } = await import('pdfkit');
	const doc = new PDFDocument();
	const filename = `health-records-${userId}-${Date.now()}.pdf`;

	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

	doc.pipe(res);

	doc.fontSize(20).text('Health Records Export', { align: 'center' });
	doc.fontSize(12).text(`User ID: ${userId}`, { align: 'center' });
	doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
	doc.moveDown();

	try {
		const { data: healthProfile } = await supabaseAdmin.from('health_profile').select('*').eq('user_id', userId).maybeSingle();
		doc.fontSize(14).text('Health Profile', { underline: true });
		doc.fontSize(11);
		const d = healthProfile?.data && typeof healthProfile.data === 'object' ? healthProfile.data : {};
		if (d.conditions) {
			doc.text(`Conditions: ${Array.isArray(d.conditions) ? d.conditions.join(', ') : d.conditions}`);
		}
		if (d.allergies) {
			doc.text(`Allergies: ${Array.isArray(d.allergies) ? d.allergies.join(', ') : d.allergies}`);
		}
		doc.moveDown();
	} catch (error) {
		logger.warn(`Failed to fetch health profile: ${error.message}`);
	}

	try {
		const { data: medications } = await supabaseAdmin.from('prescriptions').select('*').eq('user_id', userId);
		if (medications && medications.length > 0) {
			doc.fontSize(14).text('Current Medications', { underline: true });
			doc.fontSize(11);
			medications.forEach((med) => {
				doc.text(`• ${med.medication_name} - ${med.dosage} (${med.frequency})`);
			});
			doc.moveDown();
		}
	} catch (error) {
		logger.warn(`Failed to fetch medications: ${error.message}`);
	}

	try {
		const { data: appointments } = await supabaseAdmin
			.from('appointments')
			.select('*')
			.eq('user_id', userId)
			.order('appointment_date', { ascending: false })
			.limit(10);
		if (appointments && appointments.length > 0) {
			doc.fontSize(14).text('Recent Appointments', { underline: true });
			doc.fontSize(11);
			appointments.forEach((apt) => {
				doc.text(`• ${apt.appointment_date} at ${apt.appointment_time} - ${apt.type}`);
			});
			doc.moveDown();
		}
	} catch (error) {
		logger.warn(`Failed to fetch appointments: ${error.message}`);
	}

	doc.end();
}

async function exportLabResultsAsPDF(userId, res) {
	const { default: PDFDocument } = await import('pdfkit');
	const doc = new PDFDocument();
	const filename = `lab-results-${userId}-${Date.now()}.pdf`;

	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

	doc.pipe(res);

	doc.fontSize(20).text('Lab Results Export', { align: 'center' });
	doc.fontSize(12).text(`User ID: ${userId}`, { align: 'center' });
	doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
	doc.moveDown();

	try {
		const { data: labResults } = await supabaseAdmin
			.from('lab_results')
			.select('*')
			.eq('user_id', userId)
			.order('date_tested', { ascending: false });

		if (labResults && labResults.length > 0) {
			doc.fontSize(14).text('Lab Results', { underline: true });
			doc.fontSize(11);
			labResults.forEach((result) => {
				const d = result.data && typeof result.data === 'object' ? result.data : {};
				doc.text(`Test: ${d.test_name ?? d.name ?? 'Lab'}`);
				doc.text(`Date: ${result.date_tested ?? d.test_date ?? ''}`);
				doc.text(`Result: ${d.result_value ?? d.result ?? ''} ${d.unit || ''}`);
				doc.text(`Reference Range: ${d.reference_range || 'N/A'}`);
				doc.moveDown(0.5);
			});
		} else {
			doc.text('No lab results found.');
		}
	} catch (error) {
		logger.warn(`Failed to fetch lab results: ${error.message}`);
		doc.text('Unable to fetch lab results.');
	}

	doc.end();
}

async function exportMedicationsAsCSV(userId, res) {
	const { data: medications } = await supabaseAdmin.from('prescriptions').select('*').eq('user_id', userId);

	const csvData = (medications || []).map((med) => ({
		'Medication Name': med.medication_name,
		Dosage: med.dosage,
		Frequency: med.frequency,
		Quantity: med.quantity,
		'Refills Remaining': med.refills_remaining,
		Status: med.status,
		'Start date': med.start_date,
	}));

	const csv = generateCSV(csvData);
	const filename = `medications-${userId}-${Date.now()}.csv`;

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	res.send(csv);
}

async function exportAppointmentsAsCSV(userId, res) {
	const { data: appointments } = await supabaseAdmin
		.from('appointments')
		.select('*')
		.eq('user_id', userId)
		.order('appointment_date', { ascending: false });

	const csvData = (appointments || []).map((apt) => ({
		Date: apt.appointment_date,
		Time: apt.appointment_time,
		Type: apt.type,
		Reason: apt.reason,
		Status: apt.status,
	}));

	const csv = generateCSV(csvData);
	const filename = `appointments-${userId}-${Date.now()}.csv`;

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	res.send(csv);
}

async function exportWellnessActivitiesAsCSV(userId, res) {
	const { data: activities } = await supabaseAdmin
		.from('wellness_activities')
		.select('*')
		.eq('user_id', userId)
		.order('occurred_at', { ascending: false });

	const csvData = (activities || []).map((activity) => ({
		Date: activity.occurred_at,
		'Activity Type': activity.activity_type,
		Payload: activity.payload ? JSON.stringify(activity.payload) : '',
	}));

	const csv = generateCSV(csvData);
	const filename = `wellness-activities-${userId}-${Date.now()}.csv`;

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	res.send(csv);
}

export default router;
