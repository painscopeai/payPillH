import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBrowserSupabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { useAuth } from './AuthContext.jsx';
import { ensurePatientRecord, yearsBetweenDates } from '@/lib/authUtils.js';
import { toast } from 'sonner';

const OnboardingContext = createContext(null);
const TOTAL_STEPS = 14;

function mergeProfileIntoStep1(formData, profile, authEmail) {
	const step1 = {
		first_name: profile?.first_name || '',
		last_name: profile?.last_name || '',
		email: profile?.email || authEmail || '',
		phone: profile?.phone || '',
		preferred_username: profile?.preferred_username || '',
		preferred_language: profile?.preferred_language || '',
		terms_acceptance: profile?.terms_accepted ?? undefined,
		privacy_preferences: profile?.privacy_preferences ?? undefined,
		...(formData.step1 || {}),
	};
	return { ...formData, step1 };
}

/** Normalize Postgres/ISO date to yyyy-mm-dd for `<input type="date" />`. */
function toDateInputValue(value) {
	if (value == null || value === '') return '';
	const s = typeof value === 'string' ? value : String(value);
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : '';
}

function mergeProfileIntoStep2(formData, profile) {
	const existing = formData.step2 || {};
	if (existing.date_of_birth) return formData;
	const raw = profile?.date_of_birth;
	const dobStr = toDateInputValue(raw);
	if (!dobStr) return formData;
	return {
		...formData,
		step2: {
			...existing,
			date_of_birth: dobStr,
			age: yearsBetweenDates(dobStr),
		},
	};
}

export const OnboardingProvider = ({ children }) => {
	const { currentUser } = useAuth();
	const navigate = useNavigate();
	const [currentStep, setCurrentStep] = useState(1);
	const [completedSteps, setCompletedSteps] = useState([]);
	const [formData, setFormData] = useState({});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const [patientId, setPatientId] = useState(null);
	const [hydrated, setHydrated] = useState(false);
	const saveTimer = useRef(null);

	const userId = currentUser?.id;

	const loadFromSupabase = useCallback(async () => {
		if (!userId) {
			setPatientId(null);
			setHydrated(false);
			return;
		}
		const sb = getBrowserSupabase();
		try {
			const pid = await ensurePatientRecord(userId);
			setPatientId(pid);

			const { data: profile, error: pErr } = await sb
				.from('profiles')
				.select('onboarding_draft, onboarding_current_step, onboarding_skipped_steps, email, first_name, last_name, phone, preferred_username, preferred_language, terms_accepted, privacy_preferences, onboarding_completed, date_of_birth')
				.eq('id', userId)
				.maybeSingle();
			if (pErr) throw pErr;

			const draft = (profile?.onboarding_draft && typeof profile.onboarding_draft === 'object')
				? profile.onboarding_draft
				: {};
			let merged = { ...draft };
			merged = mergeProfileIntoStep1(merged, profile, currentUser?.email);
			merged = mergeProfileIntoStep2(merged, profile);

			setFormData(merged);
			if (profile?.onboarding_current_step >= 1 && profile?.onboarding_current_step <= TOTAL_STEPS) {
				setCurrentStep(profile.onboarding_current_step);
			}
		} catch (e) {
			console.error('[OnboardingContext] load', e);
			toast.error('Could not load profile progress.');
		} finally {
			setHydrated(true);
		}
	}, [userId, currentUser?.email]);

	useEffect(() => {
		loadFromSupabase();
	}, [loadFromSupabase]);

	const flushSave = useCallback(async (showToast, stepOverride) => {
		if (!userId) return;
		const sb = getBrowserSupabase();
		const step = stepOverride !== undefined ? stepOverride : currentStep;
		const payload = {
			onboarding_draft: formData,
			onboarding_current_step: step,
			updated_at: new Date().toISOString(),
		};
		const { error: upErr } = await sb.from('profiles').update(payload).eq('id', userId);
		if (upErr) {
			console.error('[OnboardingContext] save', upErr);
			if (showToast) toast.error('Failed to save progress.');
			return;
		}
		if (showToast) toast.success('Progress saved');
	}, [userId, formData, currentStep]);

	useEffect(() => {
		if (!hydrated || !userId) return;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			flushSave(false);
		}, 800);
		return () => clearTimeout(saveTimer.current);
	}, [formData, currentStep, hydrated, userId, flushSave]);

	const saveProgress = useCallback(async (showToast = true) => {
		if (!userId) {
			if (showToast) toast.error('Not signed in.');
			return;
		}
		await flushSave(showToast);
	}, [userId, flushSave]);

	const updateFormData = (step, data) => {
		setFormData((prev) => ({
			...prev,
			[`step${step}`]: { ...(prev[`step${step}`] || {}), ...data },
		}));
	};

	const nextStep = async () => {
		const next = Math.min(currentStep + 1, TOTAL_STEPS);
		setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
		setCurrentStep(next);
		void flushSave(false, next).catch((e) => console.warn('[OnboardingContext] background save after next', e));
	};

	const previousStep = () => {
		setCurrentStep((prev) => Math.max(prev - 1, 1));
	};

	const goToStep = (step) => {
		if (step >= 1 && step <= TOTAL_STEPS) setCurrentStep(step);
	};

	const completeOnboarding = async () => {
		if (!userId || !patientId) {
			toast.error('Missing account information.');
			throw new Error('Missing patient');
		}
		setIsLoading(true);
		setError(null);
		try {
			await flushSave(false);
			const sb = getBrowserSupabase();

			const { error: pErr } = await sb.from('profiles').update({
				onboarding_completed: true,
				onboarding_completed_at: new Date().toISOString(),
				profile_completion_percent: 100,
				onboarding_status: 'complete',
				updated_at: new Date().toISOString(),
			}).eq('id', userId);
			if (pErr) throw pErr;

			const { data: existing } = await sb.from('patient_profiles').select('id').eq('patient_id', patientId).maybeSingle();
			const row = {
				patient_id: patientId,
				payload: formData,
				updated_at: new Date().toISOString(),
			};
			if (existing?.id) {
				await sb.from('patient_profiles').update({ payload: formData, updated_at: row.updated_at }).eq('id', existing.id);
			} else {
				await sb.from('patient_profiles').insert(row);
			}

			try {
				const res = await apiServerClient.fetch('/onboarding/processing-snapshot', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ payload: formData, stage: 'complete' }),
				});
				if (!res.ok) await res.text().catch(() => {});
			} catch (_) {
				/* backend snapshot is best-effort; user flow already succeeded */
			}

			toast.success('Onboarding completed!');
			navigate('/patient/dashboard');
		} catch (err) {
			console.error('[OnboardingContext] complete', err);
			setError(err.message);
			toast.error(err.message || 'Could not complete onboarding');
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const resetOnboarding = () => {
		setFormData({});
		setCurrentStep(1);
		setCompletedSteps([]);
	};

	return (
		<OnboardingContext.Provider value={{
			currentStep,
			completedSteps,
			formData,
			isLoading,
			error,
			patientId,
			updateFormData,
			nextStep,
			previousStep,
			goToStep,
			saveProgress,
			completeOnboarding,
			resetOnboarding,
			hydrated,
		}}
		>
			{children}
		</OnboardingContext.Provider>
	);
};

export const useOnboarding = () => useContext(OnboardingContext);
