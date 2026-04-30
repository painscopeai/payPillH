import { Router } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import {
	sendAppointmentCreatedToPatient,
	sendAppointmentCreatedToProvider,
	sendAppointmentDetailMail,
} from '../services/email/resendMail.js';
import { resolveBookingEmails } from '../services/resolveParticipants.js';

const router = Router();

function validateAppointmentDateTime(appointmentDate, appointmentTime) {
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(appointmentDate)) {
		return {
			valid: false,
			error: 'Invalid date format. Expected YYYY-MM-DD (e.g., 2026-04-29)',
		};
	}

	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(appointmentTime)) {
		return {
			valid: false,
			error: 'Invalid time format. Expected HH:MM in 24-hour format (e.g., 14:30)',
		};
	}

	const [year, month, day] = appointmentDate.split('-').map(Number);
	const appointmentDateObj = new Date(year, month - 1, day);

	if (
		appointmentDateObj.getFullYear() !== year ||
		appointmentDateObj.getMonth() !== month - 1 ||
		appointmentDateObj.getDate() !== day
	) {
		return {
			valid: false,
			error: 'Invalid calendar date. Please check the date values.',
		};
	}

	const today = new Date();
	const todayAtStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

	if (appointmentDateObj.getTime() < todayAtStartOfDay.getTime()) {
		return {
			valid: false,
			error: 'Appointment date is in the past. Please select today or a future date.',
		};
	}

	return { valid: true };
}

async function notifyAppointmentCreated(userId, providerId, appointmentDate, appointmentTime, type) {
	const { patientEmail, providerEmail, patientLabel, providerDisplay } = await resolveBookingEmails(userId, providerId);
	const tasks = [];
	if (patientEmail) {
		tasks.push(
			sendAppointmentCreatedToPatient({
				to: patientEmail,
				appointmentDate,
				appointmentTime,
				type,
				providerName: providerDisplay,
			})
		);
	}
	if (providerEmail) {
		tasks.push(
			sendAppointmentCreatedToProvider({
				to: providerEmail,
				patientLabel,
				appointmentDate,
				appointmentTime,
				type,
			})
		);
	}
	await Promise.allSettled(tasks);
}

/**
 * POST /appointments
 */
router.post('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { user_id, provider_id, appointment_date, appointment_time, type, reason } = req.body;

	if (!user_id || !provider_id || !appointment_date || !appointment_time || !type) {
		return res.status(400).json({
			error: 'Missing required fields: user_id, provider_id, appointment_date, appointment_time, type',
		});
	}

	const dateTimeValidation = validateAppointmentDateTime(appointment_date, appointment_time);
	if (!dateTimeValidation.valid) {
		return res.status(400).json({ error: dateTimeValidation.error });
	}

	const { data: provider, error: pErr } = await supabaseAdmin.from('providers').select('id').eq('id', provider_id).maybeSingle();
	if (pErr || !provider) {
		return res.status(400).json({ error: 'Provider not found' });
	}

	const row = {
		user_id,
		provider_id,
		appointment_date,
		appointment_time,
		type,
		reason: reason || '',
		status: 'scheduled',
	};

	const { data: appointment, error: insErr } = await supabaseAdmin.from('appointments').insert(row).select('*').single();
	if (insErr) {
		logger.error('[appointments] insert', insErr);
		return res.status(500).json({ error: 'create_failed' });
	}

	try {
		await notifyAppointmentCreated(user_id, provider_id, appointment_date, appointment_time, type);
	} catch (e) {
		logger.warn('[appointments] notify', e.message);
	}

	logger.info(`Appointment created: ${appointment.id}`);

	res.status(201).json({
		id: appointment.id,
		status: appointment.status,
		appointment_date: appointment.appointment_date,
		appointment_time: appointment.appointment_time,
	});
});

/**
 * POST /appointments/book — canonical table: public.appointments
 */
router.post('/book', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const {
		userId,
		providerId,
		providerName,
		appointmentType,
		appointmentDate,
		appointmentTime,
		location,
		reason,
		insuranceInfo,
		copayAmount,
	} = req.body;

	if (!userId || !providerId || !appointmentDate || !appointmentTime || !appointmentType) {
		return res.status(400).json({
			error: 'Missing required fields: userId, providerId, appointmentDate, appointmentTime, appointmentType',
		});
	}

	const dateTimeValidation = validateAppointmentDateTime(appointmentDate, appointmentTime);
	if (!dateTimeValidation.valid) {
		return res.status(400).json({ error: dateTimeValidation.error });
	}

	const { data: providerRow, error: pErr } = await supabaseAdmin
		.from('providers')
		.select('id, display_name')
		.eq('id', providerId)
		.maybeSingle();
	if (pErr || !providerRow) {
		return res.status(400).json({ error: 'Provider not found' });
	}

	const confirmationNumber = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
	const metadata = {
		provider_name: providerName || providerRow.display_name,
		location: location || '',
		insurance_info: insuranceInfo || '',
		copay_amount: copayAmount ?? 0,
	};

	const row = {
		user_id: userId,
		provider_id: providerId,
		appointment_date: appointmentDate,
		appointment_time: appointmentTime,
		type: appointmentType,
		reason: reason || '',
		status: 'confirmed',
		confirmation_number: confirmationNumber,
		metadata,
	};

	const { data: appointment, error: insErr } = await supabaseAdmin.from('appointments').insert(row).select('*').single();
	if (insErr) {
		logger.error('[appointments/book] insert', insErr);
		return res.status(500).json({ error: 'create_failed' });
	}

	try {
		const { patientEmail, providerEmail, patientLabel } = await resolveBookingEmails(userId, providerId);
		const displayName = providerName || providerRow.display_name || 'Provider';
		if (patientEmail) {
			await sendAppointmentDetailMail({
				to: patientEmail,
				subject: `Appointment confirmation — ${confirmationNumber}`,
				html: `
					<h2>Appointment confirmed</h2>
					<p><strong>Confirmation:</strong> ${confirmationNumber}</p>
					<p><strong>Provider:</strong> ${displayName}</p>
					<p><strong>Date:</strong> ${appointmentDate}</p>
					<p><strong>Time:</strong> ${appointmentTime}</p>
					<p><strong>Location:</strong> ${location || '—'}</p>
					<p><strong>Type:</strong> ${appointmentType}</p>
					${copayAmount ? `<p><strong>Copay:</strong> $${copayAmount}</p>` : ''}
				`,
			});
		}
		if (providerEmail) {
			await sendAppointmentDetailMail({
				to: providerEmail,
				subject: `New booking — ${confirmationNumber}`,
				html: `
					<h2>New appointment</h2>
					<p><strong>Patient:</strong> ${patientLabel}</p>
					<p><strong>Confirmation:</strong> ${confirmationNumber}</p>
					<p><strong>Date:</strong> ${appointmentDate}</p>
					<p><strong>Time:</strong> ${appointmentTime}</p>
					<p><strong>Type:</strong> ${appointmentType}</p>
					<p><strong>Location:</strong> ${location || '—'}</p>
				`,
			});
		}
	} catch (e) {
		logger.warn('[appointments/book] email', e.message);
	}

	logger.info(`Appointment booked: ${appointment.id} ${confirmationNumber}`);

	res.status(201).json({
		id: appointment.id,
		confirmationNumber,
		status: 'confirmed',
		appointmentDate: appointment.appointment_date,
		appointmentTime: appointment.appointment_time,
		provider: providerName || providerRow.display_name,
		location: location || '',
		copayAmount: copayAmount || 0,
	});
});

/**
 * GET /appointments
 */
router.get('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { user_id, provider_id, status } = req.query;

	let q = supabaseAdmin.from('appointments').select('*').order('appointment_date', { ascending: false });
	if (user_id) q = q.eq('user_id', user_id);
	if (provider_id) q = q.eq('provider_id', provider_id);
	if (status) q = q.eq('status', status);

	const { data: appointments, error } = await q;
	if (error) {
		logger.error('[appointments] list', error);
		return res.status(500).json({ error: 'list_failed' });
	}

	const withProviders = await Promise.all(
		(appointments || []).map(async (apt) => {
			try {
				const { data: prov } = await supabaseAdmin.from('providers').select('*').eq('id', apt.provider_id).maybeSingle();
				return { ...apt, provider_details: prov };
			} catch (e) {
				logger.warn(`Failed to fetch provider ${apt.provider_id}:`, e.message);
				return apt;
			}
		})
	);

	res.json(withProviders);
});

/**
 * PUT /appointments/:id
 */
router.put('/:id', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { id } = req.params;
	const { status, notes, appointment_date, appointment_time } = req.body;

	const { data: existingAppointment, error: getErr } = await supabaseAdmin.from('appointments').select('*').eq('id', id).maybeSingle();
	if (getErr || !existingAppointment) {
		return res.status(404).json({ error: 'Not found' });
	}

	if (appointment_date && appointment_time) {
		const dateTimeValidation = validateAppointmentDateTime(appointment_date, appointment_time);
		if (!dateTimeValidation.valid) {
			return res.status(400).json({ error: dateTimeValidation.error });
		}
	}

	const updateData = { updated_at: new Date().toISOString() };
	if (status) updateData.status = status;
	if (notes !== undefined) updateData.notes = notes;
	if (appointment_date) updateData.appointment_date = appointment_date;
	if (appointment_time) updateData.appointment_time = appointment_time;

	const { data: updatedAppointment, error: upErr } = await supabaseAdmin
		.from('appointments')
		.update(updateData)
		.eq('id', id)
		.select('*')
		.single();
	if (upErr) {
		logger.error('[appointments] update', upErr);
		return res.status(500).json({ error: 'update_failed' });
	}

	try {
		const { patientEmail, providerEmail, patientLabel } = await resolveBookingEmails(
			existingAppointment.user_id,
			existingAppointment.provider_id
		);
		if (status === 'cancelled' && existingAppointment.status !== 'cancelled' && patientEmail) {
			await sendAppointmentDetailMail({
				to: patientEmail,
				subject: 'Appointment cancelled',
				html: `<p>Your appointment scheduled for ${existingAppointment.appointment_date} has been cancelled.</p>`,
			});
			if (providerEmail) {
				await sendAppointmentDetailMail({
					to: providerEmail,
					subject: 'Appointment cancelled',
					html: `<p>Appointment with ${patientLabel} on ${existingAppointment.appointment_date} was cancelled.</p>`,
				});
			}
		} else if ((appointment_date || appointment_time) && existingAppointment.status === 'scheduled') {
			const newDate = appointment_date || existingAppointment.appointment_date;
			const newTime = appointment_time || existingAppointment.appointment_time;
			if (patientEmail) {
				await sendAppointmentDetailMail({
					to: patientEmail,
					subject: 'Appointment rescheduled',
					html: `<p>Your appointment has been moved to ${newDate} at ${newTime}.</p>`,
				});
			}
			if (providerEmail) {
				await sendAppointmentDetailMail({
					to: providerEmail,
					subject: 'Appointment rescheduled',
					html: `<p>${patientLabel} — appointment moved to ${newDate} at ${newTime}.</p>`,
				});
			}
		}
	} catch (e) {
		logger.warn('[appointments] update email', e.message);
	}

	res.json(updatedAppointment);
});

/**
 * DELETE /appointments/:id
 */
router.delete('/:id', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { id } = req.params;

	const { data: appointment, error: getErr } = await supabaseAdmin.from('appointments').select('*').eq('id', id).maybeSingle();
	if (getErr || !appointment) {
		return res.status(404).json({ error: 'Not found' });
	}

	const { error: delErr } = await supabaseAdmin.from('appointments').delete().eq('id', id);
	if (delErr) {
		logger.error('[appointments] delete', delErr);
		return res.status(500).json({ error: 'delete_failed' });
	}

	try {
		const { patientEmail, providerEmail, patientLabel } = await resolveBookingEmails(appointment.user_id, appointment.provider_id);
		if (patientEmail) {
			await sendAppointmentDetailMail({
				to: patientEmail,
				subject: 'Appointment cancelled',
				html: `<p>Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} has been cancelled.</p>`,
			});
		}
		if (providerEmail) {
			await sendAppointmentDetailMail({
				to: providerEmail,
				subject: 'Appointment cancelled',
				html: `<p>Appointment with ${patientLabel} on ${appointment.appointment_date} at ${appointment.appointment_time} was cancelled.</p>`,
			});
		}
	} catch (e) {
		logger.warn('[appointments] delete email', e.message);
	}

	res.json({ success: true });
});

export default router;
