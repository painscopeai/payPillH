import 'dotenv/config';
import logger from './logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

function metricsFlat(metrics) {
	if (!metrics || typeof metrics !== 'object') return {};
	return metrics;
}

/**
 * Fetch and prepare patient health data for AI analysis.
 * `patientId` is the authenticated user's id (`auth.users.id`).
 */
export async function preparePatientDataForAnalysis(patientId) {
	const healthData = {
		patient_id: patientId,
		age: null,
		gender: null,
		conditions: [],
		medications: [],
		allergies: [],
		vitals: {},
		lifestyle: {},
		family_history: [],
		health_goals: [],
		recent_appointments: [],
		lab_results: [],
	};

	if (!supabaseAdmin) {
		return healthData;
	}

	try {
		const [
			profileRes,
			hpRes,
			conditionsRes,
			allergiesRes,
			familyRes,
			rxRes,
			goalsRes,
			apptsRes,
			labsRes,
			vitalsRes,
			lifestyleRes,
		] = await Promise.all([
			supabaseAdmin.from('profiles').select('date_of_birth').eq('id', patientId).maybeSingle(),
			supabaseAdmin.from('health_profile').select('data, pregnancy_status').eq('user_id', patientId).maybeSingle(),
			supabaseAdmin.from('pre_existing_conditions').select('condition_name').eq('user_id', patientId),
			supabaseAdmin.from('allergies').select('allergen, reaction').eq('user_id', patientId),
			supabaseAdmin.from('family_medical_history').select('relation, condition, notes').eq('user_id', patientId),
			supabaseAdmin.from('prescriptions').select('*').eq('user_id', patientId).eq('status', 'active'),
			supabaseAdmin.from('health_goals').select('title, goal_type, status, target').eq('user_id', patientId).eq('status', 'active'),
			supabaseAdmin
				.from('appointments')
				.select('appointment_date, appointment_time, type, reason')
				.eq('user_id', patientId)
				.order('appointment_date', { ascending: false })
				.limit(5),
			supabaseAdmin
				.from('lab_results')
				.select('date_tested, data')
				.eq('user_id', patientId)
				.order('date_tested', { ascending: false })
				.limit(10),
			supabaseAdmin
				.from('vitals')
				.select('measured_at, metrics')
				.eq('user_id', patientId)
				.order('measured_at', { ascending: false })
				.limit(1),
			supabaseAdmin.from('lifestyle_habits').select('payload').eq('user_id', patientId).maybeSingle(),
		]);

		const profile = profileRes.data;
		const hp = hpRes.data;
		const data = hp?.data && typeof hp.data === 'object' ? hp.data : {};

		if (profile?.date_of_birth) {
			const dob = new Date(profile.date_of_birth);
			healthData.age = new Date().getFullYear() - dob.getFullYear();
		} else if (data.date_of_birth) {
			const dob = new Date(data.date_of_birth);
			healthData.age = new Date().getFullYear() - dob.getFullYear();
		}

		healthData.gender = data.gender ?? null;

		if (Array.isArray(conditionsRes.data)) {
			healthData.conditions = conditionsRes.data.map((c) => c.condition_name).filter(Boolean);
		}
		if (healthData.conditions.length === 0 && Array.isArray(data.conditions)) {
			healthData.conditions = data.conditions;
		}

		if (Array.isArray(allergiesRes.data)) {
			healthData.allergies = allergiesRes.data
				.map((a) => [a.allergen, a.reaction].filter(Boolean).join(' — '))
				.filter(Boolean);
		}
		if (Array.isArray(data.allergies)) {
			healthData.allergies = [...new Set([...healthData.allergies, ...data.allergies])];
		}

		if (Array.isArray(familyRes.data)) {
			healthData.family_history = familyRes.data.map((f) =>
				[f.relation, f.condition, f.notes].filter(Boolean).join(' — ')
			);
		}

		if (Array.isArray(rxRes.data)) {
			healthData.medications = rxRes.data.map((med) => ({
				name: med.medication_name,
				dosage: med.dosage,
				frequency: med.frequency,
			}));
		}

		if (Array.isArray(goalsRes.data)) {
			healthData.health_goals = goalsRes.data.map((goal) => ({
				name: goal.title,
				type: goal.goal_type,
				target_value: goal.target,
			}));
		}

		if (Array.isArray(apptsRes.data)) {
			healthData.recent_appointments = apptsRes.data.map((apt) => ({
				date: apt.appointment_date,
				type: apt.type,
				reason: apt.reason,
			}));
		}

		if (Array.isArray(labsRes.data)) {
			healthData.lab_results = labsRes.data.map((row) => {
				const d = row.data && typeof row.data === 'object' ? row.data : {};
				return {
					test_name: d.test_name ?? d.name ?? 'Lab',
					result_value: d.result_value ?? d.result ?? '',
					unit: d.unit ?? '',
					reference_range: d.reference_range ?? '',
					test_date: row.date_tested ?? d.test_date,
				};
			});
		}

		if (vitalsRes.data?.[0]) {
			const m = metricsFlat(vitalsRes.data[0].metrics);
			healthData.vitals = {
				height: m.height,
				weight: m.weight,
				bmi: m.bmi,
				systolic_bp: m.systolic_bp ?? m.systolic,
				diastolic_bp: m.diastolic_bp ?? m.diastolic,
				heart_rate: m.heart_rate,
				temperature: m.temperature,
				recorded_at: vitalsRes.data[0].measured_at,
			};
		}

		const habitPayload = lifestyleRes.data?.payload;
		if (habitPayload && typeof habitPayload === 'object') {
			healthData.lifestyle = {
				smoking_status: habitPayload.smoking_status ?? data.smoking_status ?? 'unknown',
				alcohol_consumption: habitPayload.alcohol_consumption ?? data.alcohol_consumption ?? 'unknown',
				exercise_level: habitPayload.exercise_level ?? data.exercise_level ?? 'unknown',
				sleep_quality: habitPayload.sleep_quality ?? data.sleep_quality ?? 'unknown',
			};
		} else {
			healthData.lifestyle = {
				smoking_status: data.smoking_status ?? 'unknown',
				alcohol_consumption: data.alcohol_consumption ?? 'unknown',
				exercise_level: data.exercise_level ?? 'unknown',
				sleep_quality: data.sleep_quality ?? 'unknown',
			};
		}
	} catch (error) {
		logger.warn(`Error preparing patient data for analysis: ${error.message}`);
	}

	return healthData;
}

/**
 * Format health data for Gemini API prompt
 */
export function formatHealthDataForPrompt(healthData) {
	const lines = [];

	lines.push('=== PATIENT HEALTH PROFILE ===');
	lines.push(`Age: ${healthData.age || 'Not provided'}`);
	lines.push(`Gender: ${healthData.gender || 'Not provided'}`);
	lines.push('');

	if (healthData.conditions.length > 0) {
		lines.push('Current Conditions:');
		healthData.conditions.forEach((condition) => {
			lines.push(`  - ${condition}`);
		});
		lines.push('');
	}

	if (healthData.medications.length > 0) {
		lines.push('Current Medications:');
		healthData.medications.forEach((med) => {
			lines.push(`  - ${med.name} ${med.dosage} (${med.frequency})`);
		});
		lines.push('');
	}

	if (healthData.allergies.length > 0) {
		lines.push('Allergies:');
		healthData.allergies.forEach((allergy) => {
			lines.push(`  - ${allergy}`);
		});
		lines.push('');
	}

	if (Object.keys(healthData.vitals).length > 0) {
		lines.push('Latest Vital Signs:');
		if (healthData.vitals.height) lines.push(`  - Height: ${healthData.vitals.height} cm`);
		if (healthData.vitals.weight) lines.push(`  - Weight: ${healthData.vitals.weight} kg`);
		if (healthData.vitals.bmi) lines.push(`  - BMI: ${healthData.vitals.bmi}`);
		if (healthData.vitals.systolic_bp) {
			lines.push(`  - Blood Pressure: ${healthData.vitals.systolic_bp}/${healthData.vitals.diastolic_bp} mmHg`);
		}
		if (healthData.vitals.heart_rate) lines.push(`  - Heart Rate: ${healthData.vitals.heart_rate} bpm`);
		lines.push('');
	}

	if (healthData.family_history.length > 0) {
		lines.push('Family Medical History:');
		healthData.family_history.forEach((history) => {
			lines.push(`  - ${history}`);
		});
		lines.push('');
	}

	if (healthData.health_goals.length > 0) {
		lines.push('Health Goals:');
		healthData.health_goals.forEach((goal) => {
			lines.push(`  - ${goal.name} (${goal.type})`);
		});
		lines.push('');
	}

	if (healthData.lifestyle && Object.keys(healthData.lifestyle).length > 0) {
		lines.push('Lifestyle Factors:');
		lines.push(`  - Smoking: ${healthData.lifestyle.smoking_status}`);
		lines.push(`  - Alcohol: ${healthData.lifestyle.alcohol_consumption}`);
		lines.push(`  - Exercise: ${healthData.lifestyle.exercise_level}`);
		lines.push(`  - Sleep: ${healthData.lifestyle.sleep_quality}`);
		lines.push('');
	}

	return lines.join('\n');
}
