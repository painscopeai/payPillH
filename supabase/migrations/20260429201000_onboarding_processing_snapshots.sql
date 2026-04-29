-- Backend-only onboarding payloads for downstream jobs (API inserts via service role; no client access)

create table public.onboarding_processing_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  payload jsonb not null,
  stage text not null default 'complete',
  created_at timestamptz not null default now()
);

create index idx_onboarding_snapshots_user_id on public.onboarding_processing_snapshots (user_id);
create index idx_onboarding_snapshots_created_at on public.onboarding_processing_snapshots (created_at desc);

alter table public.onboarding_processing_snapshots enable row level security;

comment on table public.onboarding_processing_snapshots is 'Inserted only by Express (service role). Full onboarding JSON for backend pipelines.';
