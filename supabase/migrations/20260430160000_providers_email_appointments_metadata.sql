-- Support notification targeting and richer booking payloads

alter table public.providers add column if not exists email text;

alter table public.appointments add column if not exists confirmation_number text;
alter table public.appointments add column if not exists metadata jsonb default '{}'::jsonb;

comment on column public.providers.email is 'Optional clinic email for notifications; else derived from providers.user_id → profiles.email';

alter table public.refill_requests add column if not exists metadata jsonb default '{}'::jsonb;
