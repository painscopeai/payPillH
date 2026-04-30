import { Resend } from 'resend';
import logger from '../../utils/logger.js';

const apiKey = process.env.RESEND_API_KEY;
const fromDefault = process.env.RESEND_FROM || 'onboarding@resend.dev';

let client = null;
if (apiKey) {
	try {
		client = new Resend(apiKey);
	} catch (e) {
		logger.warn('[resend] init failed', e.message);
	}
}

function canSend() {
	return !!(client && fromDefault);
}

/**
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
export async function sendTransactionalMail(opts) {
	if (!canSend()) {
		logger.warn('[resend] skipped (RESEND_API_KEY or RESEND_FROM missing)');
		return { skipped: true };
	}
	const { to, subject, html, text } = opts;
	if (!to?.trim()) {
		logger.warn('[resend] skipped empty recipient');
		return { skipped: true };
	}
	try {
		const { data, error } = await client.emails.send({
			from: fromDefault,
			to: [to.trim()],
			subject,
			html,
			...(text ? { text } : {}),
		});
		if (error) {
			logger.warn('[resend] API error', error);
			return { error };
		}
		return { data };
	} catch (e) {
		logger.warn('[resend] send failed', e.message);
		return { error: e };
	}
}

export async function sendAppointmentCreatedToPatient({ to, appointmentDate, appointmentTime, type, providerName }) {
	const html = `
		<p>Your appointment has been scheduled.</p>
		<ul>
			<li><strong>Date:</strong> ${appointmentDate}</li>
			<li><strong>Time:</strong> ${appointmentTime}</li>
			<li><strong>Type:</strong> ${type}</li>
			${providerName ? `<li><strong>Provider:</strong> ${providerName}</li>` : ''}
		</ul>
		<p>— PayPill</p>
	`;
	return sendTransactionalMail({
		to,
		subject: 'Appointment confirmation',
		html,
	});
}

export async function sendAppointmentCreatedToProvider({ to, patientLabel, appointmentDate, appointmentTime, type }) {
	const html = `
		<p>A new appointment has been booked.</p>
		<ul>
			<li><strong>Patient:</strong> ${patientLabel}</li>
			<li><strong>Date:</strong> ${appointmentDate}</li>
			<li><strong>Time:</strong> ${appointmentTime}</li>
			<li><strong>Type:</strong> ${type}</li>
		</ul>
		<p>— PayPill</p>
	`;
	return sendTransactionalMail({
		to,
		subject: 'New appointment booked',
		html,
	});
}

export async function sendAppointmentDetailMail({ to, subject, html }) {
	return sendTransactionalMail({ to, subject, html });
}

export async function sendRefillRequestedToPatient({ to, refillLabel, medicationName, dosage }) {
	const html = `
		<h2>Refill request received</h2>
		<p><strong>${refillLabel}</strong></p>
		<p><strong>Medication:</strong> ${medicationName}</p>
		<p><strong>Dosage:</strong> ${dosage}</p>
		<p>Your pharmacy will process this request.</p>
		<p>— PayPill</p>
	`;
	return sendTransactionalMail({ to, subject: 'Prescription refill requested', html });
}
