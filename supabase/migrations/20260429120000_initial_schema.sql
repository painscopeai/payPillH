-- PayPillH initial schema (PostgreSQL / Supabase)
-- Run via: supabase db push   OR   paste into SQL editor
-- Resolves legacy naming: single vitals table; prescriptions + current_medications remain distinct (refills API).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (app fields migrated from PocketBase auth collection "users")
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  role text,
  user_type text,
  first_name text,
  last_name text,
  preferred_name text,
  phone text,
  address text,
  date_of_birth date,
  preferred_language text,
  communication_preference text,
  terms_accepted boolean,
  privacy_preferences boolean,
  two_factor_enabled boolean,
  profile_photo text,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz,
  onboarding_step text,
  onboarding_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Patients (optional 1:1 extension; links clinical "patient_id" records)
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_user_id on public.patients (user_id);

-- ---------------------------------------------------------------------------
-- Health / clinical (user-scoped)
-- ---------------------------------------------------------------------------
create table public.health_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb,
  pregnancy_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_health_profile_user_id on public.health_profile (user_id);

create table public.pre_existing_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  condition_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pre_existing_conditions_user_id on public.pre_existing_conditions (user_id);

create table public.current_medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  medication_name text,
  dosage text,
  frequency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_current_medications_user_id on public.current_medications (user_id);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  display_name text,
  specialty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_providers_user_id on public.providers (user_id);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete restrict,
  medication_name text not null,
  dosage text,
  frequency text,
  quantity numeric,
  refills_remaining integer,
  status text,
  route text,
  strength text,
  start_date date,
  end_date date,
  prescribing_provider text,
  indication text,
  side_effects text,
  adherence_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prescriptions_user_id on public.prescriptions (user_id);
create index if not exists idx_prescriptions_provider_id on public.prescriptions (provider_id);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date_tested timestamptz,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_results_user_id on public.lab_results (user_id);

-- Canonical vitals (replaces split vitals vs vital_signs in legacy code paths)
create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_vitals_user_id on public.vitals (user_id);

create table public.health_dashboard_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_dashboard_metrics_user_id on public.health_dashboard_metrics (user_id);

create table public.health_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text,
  title text,
  status text,
  target jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_goals_user_id on public.health_goals (user_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_id on public.documents (user_id);

create table public.wellness_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text,
  payload jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_wellness_activities_user_id on public.wellness_activities (user_id);

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  allergen text,
  reaction text,
  created_at timestamptz not null default now()
);

create index if not exists idx_allergies_user_id on public.allergies (user_id);

create table public.family_medical_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  relation text,
  condition text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_medical_history_user_id on public.family_medical_history (user_id);

create table public.lifestyle_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lifestyle_habits_user_id on public.lifestyle_habits (user_id);

create table public.health_insurance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_health_insurance_user_id on public.health_insurance (user_id);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text,
  phone text,
  relationship text,
  created_at timestamptz not null default now()
);

create index if not exists idx_emergency_contacts_user_id on public.emergency_contacts (user_id);

create table public.healthcare_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text,
  specialty text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_healthcare_providers_user_id on public.healthcare_providers (user_id);

-- Patient-domain AI tables (patient_id -> patients.id)
create table public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_profiles_patient_id on public.patient_profiles (patient_id);

create table public.patient_medical_conditions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_lab_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_lifestyle (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_immunizations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.patient_recommendations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text,
  body text,
  status text,
  source text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_recommendations_patient_id on public.patient_recommendations (patient_id);

create table public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references public.patient_recommendations (id) on delete cascade,
  change jsonb,
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  payload jsonb,
  status text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recommendations_user_id on public.recommendations (user_id);

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete cascade,
  bio text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_profiles_provider_id on public.provider_profiles (provider_id);

create table public.patient_provider_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  status text,
  created_at timestamptz not null default now(),
  unique (patient_id, provider_id)
);

create index if not exists idx_ppr_patient_id on public.patient_provider_relationships (patient_id);
create index if not exists idx_ppr_provider_id on public.patient_provider_relationships (provider_id);

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_notes_patient_id on public.clinical_notes (patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete restrict,
  appointment_date date not null,
  appointment_time text not null,
  type text not null,
  status text,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_user_id on public.appointments (user_id);
create index if not exists idx_appointments_provider_id on public.appointments (provider_id);
create index if not exists idx_appointments_appointment_date on public.appointments (appointment_date);

create table public.patient_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.telemedicine_sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  payload jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text,
  lat double precision,
  lng double precision,
  inventory jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refill_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prescription_id uuid references public.prescriptions (id) on delete set null,
  pharmacy_id uuid references public.pharmacies (id) on delete set null,
  requested_at timestamptz,
  requested_date date,
  status text,
  confirmed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_refill_requests_user_id on public.refill_requests (user_id);

create table public.insurance_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  address text,
  license_number text,
  plan_types jsonb,
  status text,
  created_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insurance_companies_user_id on public.insurance_companies (user_id);

create table public.insurance_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.insurance_companies (id) on delete cascade,
  member_ref text,
  health_score numeric,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insurance_members_company_id on public.insurance_members (company_id);

create table public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.insurance_members (id) on delete cascade,
  claim_type text,
  status text,
  amount numeric,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurance_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.insurance_companies (id) on delete cascade,
  contract_type text,
  contract_value numeric,
  start_date date,
  end_date date,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contract_performance (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.insurance_contracts (id) on delete cascade,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create table public.member_outcomes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.insurance_members (id) on delete cascade,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create table public.generic_drug_tracking (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.insurance_companies (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.generic_drug_savings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.insurance_companies (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.pharmacy_performance (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid references public.pharmacies (id) on delete set null,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  name text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_employees (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employers (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employer_employees_employer_id on public.employer_employees (employer_id);

create table public.employer_health_metrics (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employers (id) on delete cascade,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create table public.payment_routing_rules (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employers (id) on delete cascade,
  rule jsonb,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid,
  sender_id uuid,
  recipient_id uuid,
  body text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread_id on public.messages (thread_id);

create table public.integrated_ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  role text,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integrated_ai_messages_user_id on public.integrated_ai_messages (user_id);

create table public.integrated_ai_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text,
  resource text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_id on public.audit_logs (actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at);

comment on table public.vitals is 'Canonical vital signs; migrate legacy vital_signs queries here.';
comment on table public.prescriptions is 'Canonical prescriptions; current_medications holds patient-facing copy used by refill routes where applicable.';
