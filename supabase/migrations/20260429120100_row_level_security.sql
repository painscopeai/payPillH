-- Row Level Security — tighten policies per product rules after roles land in JWT/custom claims.

alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_self on public.profiles for update using (auth.uid() = id);

-- Helper: patient rows owned by current user
create or replace function public.is_patient_owner(pt uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patients x
    where x.id = pt and x.user_id = auth.uid()
  );
$$;

-- Generic user-scoped tables
alter table public.health_profile enable row level security;
create policy health_profile_own on public.health_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.pre_existing_conditions enable row level security;
create policy pre_existing_conditions_own on public.pre_existing_conditions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.current_medications enable row level security;
create policy current_medications_own on public.current_medications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.lab_results enable row level security;
create policy lab_results_own on public.lab_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.vitals enable row level security;
create policy vitals_own on public.vitals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.health_dashboard_metrics enable row level security;
create policy health_dashboard_metrics_own on public.health_dashboard_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.health_goals enable row level security;
create policy health_goals_own on public.health_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.documents enable row level security;
create policy documents_own on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.wellness_activities enable row level security;
create policy wellness_activities_own on public.wellness_activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.allergies enable row level security;
create policy allergies_own on public.allergies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.family_medical_history enable row level security;
create policy family_medical_history_own on public.family_medical_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.lifestyle_habits enable row level security;
create policy lifestyle_habits_own on public.lifestyle_habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.health_insurance enable row level security;
create policy health_insurance_own on public.health_insurance for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.emergency_contacts enable row level security;
create policy emergency_contacts_own on public.emergency_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.healthcare_providers enable row level security;
create policy healthcare_providers_own on public.healthcare_providers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.recommendations enable row level security;
create policy recommendations_own on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.patients enable row level security;
create policy patients_own on public.patients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Appointments: participant or linked provider user (mirrors PocketBase listRule pattern)
alter table public.appointments enable row level security;
create policy appointments_participant on public.appointments for all
  using (
    auth.uid() = user_id
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  );

alter table public.prescriptions enable row level security;
create policy prescriptions_participant on public.prescriptions for all
  using (
    auth.uid() = user_id
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  );

alter table public.refill_requests enable row level security;
create policy refill_requests_own on public.refill_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.providers enable row level security;
create policy providers_self on public.providers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.provider_profiles enable row level security;
create policy provider_profiles_via_provider on public.provider_profiles for all
  using (exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid()))
  with check (exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid()));

-- Patient-scoped clinical tables
alter table public.patient_profiles enable row level security;
create policy patient_profiles_owner on public.patient_profiles for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_medical_conditions enable row level security;
create policy patient_medical_conditions_owner on public.patient_medical_conditions for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_medications enable row level security;
create policy patient_medications_owner on public.patient_medications for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_allergies enable row level security;
create policy patient_allergies_owner on public.patient_allergies for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_medical_history enable row level security;
create policy patient_medical_history_owner on public.patient_medical_history for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_lab_history enable row level security;
create policy patient_lab_history_owner on public.patient_lab_history for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_lifestyle enable row level security;
create policy patient_lifestyle_owner on public.patient_lifestyle for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_immunizations enable row level security;
create policy patient_immunizations_owner on public.patient_immunizations for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.patient_recommendations enable row level security;
create policy patient_recommendations_owner on public.patient_recommendations for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.recommendation_requests enable row level security;
create policy recommendation_requests_owner on public.recommendation_requests for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.recommendation_history enable row level security;
create policy recommendation_history_owner on public.recommendation_history for all
  using (
    exists (
      select 1 from public.patient_recommendations r
      where r.id = recommendation_id and public.is_patient_owner(r.patient_id)
    )
  );

alter table public.patient_provider_relationships enable row level security;
create policy ppr_patient_or_provider on public.patient_provider_relationships for all
  using (
    public.is_patient_owner(patient_id)
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  )
  with check (
    public.is_patient_owner(patient_id)
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  );

alter table public.clinical_notes enable row level security;
create policy clinical_notes_participant on public.clinical_notes for all
  using (
    public.is_patient_owner(patient_id)
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.user_id = auth.uid())
  );

alter table public.patient_appointments enable row level security;
create policy patient_appointments_owner on public.patient_appointments for all
  using (public.is_patient_owner(patient_id)) with check (public.is_patient_owner(patient_id));

alter table public.telemedicine_sessions enable row level security;
create policy telemedicine_sessions_via_appointment on public.telemedicine_sessions for all
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and (
        a.user_id = auth.uid()
        or exists (select 1 from public.providers pr where pr.id = a.provider_id and pr.user_id = auth.uid())
      )
    )
  );

alter table public.messages enable row level security;
create policy messages_participant on public.messages for all
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

alter table public.integrated_ai_messages enable row level security;
create policy integrated_ai_messages_own on public.integrated_ai_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.integrated_ai_images enable row level security;
create policy integrated_ai_images_own on public.integrated_ai_images for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.insurance_companies enable row level security;
create policy insurance_companies_owner on public.insurance_companies for all
  using (user_id is null or auth.uid() = user_id)
  with check (user_id is null or auth.uid() = user_id);

alter table public.insurance_members enable row level security;
create policy insurance_members_via_company on public.insurance_members for all
  using (
    exists (
      select 1 from public.insurance_companies c
      where c.id = company_id and (c.user_id is null or c.user_id = auth.uid())
    )
  );

alter table public.insurance_claims enable row level security;
create policy insurance_claims_via_member on public.insurance_claims for all
  using (
    exists (
      select 1 from public.insurance_members m
      join public.insurance_companies c on c.id = m.company_id
      where m.id = member_id and (c.user_id is null or c.user_id = auth.uid())
    )
  );

alter table public.insurance_contracts enable row level security;
create policy insurance_contracts_via_company on public.insurance_contracts for all
  using (
    exists (
      select 1 from public.insurance_companies c
      where c.id = company_id and (c.user_id is null or c.user_id = auth.uid())
    )
  );

alter table public.contract_performance enable row level security;
create policy contract_performance_via_contract on public.contract_performance for all
  using (
    exists (
      select 1 from public.insurance_contracts ct
      join public.insurance_companies c on c.id = ct.company_id
      where ct.id = contract_id and (c.user_id is null or c.user_id = auth.uid())
    )
  );

alter table public.member_outcomes enable row level security;
create policy member_outcomes_via_member on public.member_outcomes for all
  using (
    exists (
      select 1 from public.insurance_members m
      join public.insurance_companies c on c.id = m.company_id
      where m.id = member_id and (c.user_id is null or c.user_id = auth.uid())
    )
  );

alter table public.generic_drug_tracking enable row level security;
create policy generic_drug_tracking_company on public.generic_drug_tracking for all
  using (
    company_id is null
    or exists (select 1 from public.insurance_companies c where c.id = company_id and (c.user_id is null or c.user_id = auth.uid()))
  );

alter table public.generic_drug_savings enable row level security;
create policy generic_drug_savings_company on public.generic_drug_savings for all
  using (
    company_id is null
    or exists (select 1 from public.insurance_companies c where c.id = company_id and (c.user_id is null or c.user_id = auth.uid()))
  );

alter table public.pharmacy_performance enable row level security;
create policy pharmacy_performance_read on public.pharmacy_performance for select using (true);

alter table public.employers enable row level security;
create policy employers_owner on public.employers for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

alter table public.employer_employees enable row level security;
create policy employer_employees_via on public.employer_employees for all
  using (
    exists (select 1 from public.employers e where e.id = employer_id and e.owner_user_id = auth.uid())
    or auth.uid() = user_id
  );

alter table public.employer_health_metrics enable row level security;
create policy employer_health_metrics_owner on public.employer_health_metrics for all
  using (exists (select 1 from public.employers e where e.id = employer_id and e.owner_user_id = auth.uid()));

alter table public.payment_routing_rules enable row level security;
create policy payment_routing_rules_owner on public.payment_routing_rules for all
  using (exists (select 1 from public.employers e where e.id = employer_id and e.owner_user_id = auth.uid()));

alter table public.pharmacies enable row level security;
create policy pharmacies_read on public.pharmacies for select using (true);

alter table public.audit_logs enable row level security;
create policy audit_logs_actor on public.audit_logs for select using (actor_id = auth.uid());
create policy audit_logs_insert on public.audit_logs for insert with check (actor_id = auth.uid());
