-- Extra profile fields + richer new-user trigger + onboarding draft JSON

alter table public.profiles
  add column if not exists preferred_username text;

alter table public.profiles
  add column if not exists onboarding_current_step integer default 1;

alter table public.profiles
  add column if not exists onboarding_skipped_steps integer[] default '{}';

alter table public.profiles
  add column if not exists profile_completion_percent integer default 0;

alter table public.profiles
  add column if not exists onboarding_draft jsonb default '{}'::jsonb;

comment on column public.profiles.onboarding_current_step is '1–14 wizard position';
comment on column public.profiles.profile_completion_percent is '0–100 when onboarding finished';
comment on column public.profiles.onboarding_draft is 'Merged onboarding step payloads keyed by step';

-- Age 18+ when date_of_birth is set
alter table public.profiles
  drop constraint if exists profiles_adult_dob_check;

alter table public.profiles
  add constraint profiles_adult_dob_check
  check (
    date_of_birth is null
    or date_of_birth <= (current_date - interval '18 years')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    user_type,
    phone,
    date_of_birth,
    preferred_username,
    terms_accepted,
    privacy_preferences
  )
  values (
    new.id,
    new.email,
    nullif(trim(meta->>'first_name'), ''),
    nullif(trim(meta->>'last_name'), ''),
    nullif(trim(meta->>'role'), ''),
    nullif(trim(meta->>'user_type'), ''),
    nullif(trim(meta->>'phone'), ''),
    case
      when nullif(trim(meta->>'date_of_birth'), '') is not null
      then (nullif(trim(meta->>'date_of_birth'), ''))::date
      else null
    end,
    nullif(trim(meta->>'preferred_username'), ''),
    case when meta->>'terms_accepted' in ('true', 't', '1') then true else null end,
    case when meta->>'privacy_preferences' in ('true', 't', '1') then true else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    role = coalesce(public.profiles.role, excluded.role),
    user_type = coalesce(public.profiles.user_type, excluded.user_type),
    phone = coalesce(public.profiles.phone, excluded.phone),
    date_of_birth = coalesce(public.profiles.date_of_birth, excluded.date_of_birth),
    preferred_username = coalesce(public.profiles.preferred_username, excluded.preferred_username),
    terms_accepted = coalesce(public.profiles.terms_accepted, excluded.terms_accepted),
    privacy_preferences = coalesce(public.profiles.privacy_preferences, excluded.privacy_preferences),
    updated_at = now();

  return new;
end;
$$;
