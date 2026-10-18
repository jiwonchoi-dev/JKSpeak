-- Apply in the SQL editor of a NEW Supabase project before enabling auth-config.json.
-- No service-role key belongs in the static frontend.
begin;

create or replace function public.valid_jkspeak_profile(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
 select jsonb_typeof(p) = 'object'
 and p ?& array['version','displayName','course','examFormat','englishLevel','focus','preferredMinutes','weeklyGoal','answerPreference','examDate','goal','challenges','timezone','aiConsent']
 and p - array['version','displayName','course','examFormat','englishLevel','focus','preferredMinutes','weeklyGoal','answerPreference','examDate','goal','challenges','timezone','aiConsent'] = '{}'::jsonb
 and p->>'version' = '1'
 and length(btrim(p->>'displayName')) between 1 and 60
 and length(btrim(p->>'course')) between 1 and 120
 and p->>'examFormat' in ('oral','viva','presentation')
 and p->>'englishLevel' in ('unsure','A1','A2','B1','B2','C1','C2')
 and p->>'focus' in ('structure','evidence','reasoning','relevance')
 and jsonb_typeof(p->'preferredMinutes') = 'number'
 and p->>'preferredMinutes' in ('5','10','15','20','30')
 and jsonb_typeof(p->'weeklyGoal') = 'number'
 and p->>'weeklyGoal' in ('1','2','3','4','5','6','7')
 and p->>'answerPreference' in ('type','speak','both')
 and (p->>'examDate' = '' or p->>'examDate' ~ '^\d{4}-\d{2}-\d{2}$')
 and length(p->>'goal') <= 500
 and length(p->>'timezone') between 1 and 80
 and jsonb_typeof(p->'challenges') = 'array'
 and p->'challenges' <@ '["explaining","examples","followups","organisation","confidence"]'::jsonb
 and jsonb_typeof(p->'aiConsent') = 'boolean';
$$;

create table if not exists public.learning_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 learning_profile jsonb not null check (public.valid_jkspeak_profile(learning_profile) is true),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 consent_updated_at timestamptz not null default now()
);
alter table public.learning_profiles enable row level security;
revoke all on public.learning_profiles from anon, authenticated;
grant select, insert, update on public.learning_profiles to authenticated;

drop policy if exists jkspeak_read_own_profile on public.learning_profiles;
create policy jkspeak_read_own_profile on public.learning_profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists jkspeak_insert_own_profile on public.learning_profiles;
create policy jkspeak_insert_own_profile on public.learning_profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists jkspeak_update_own_profile on public.learning_profiles;
create policy jkspeak_update_own_profile on public.learning_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.stamp_jkspeak_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at := now();
 if tg_op = 'UPDATE' then
   new.created_at := old.created_at;
   if new.learning_profile->'aiConsent' is distinct from old.learning_profile->'aiConsent' then new.consent_updated_at := now();
   else new.consent_updated_at := old.consent_updated_at; end if;
 else new.created_at := now(); new.consent_updated_at := now(); end if;
 return new;
end;
$$;
drop trigger if exists stamp_jkspeak_profile on public.learning_profiles;
create trigger stamp_jkspeak_profile before insert or update on public.learning_profiles for each row execute function public.stamp_jkspeak_profile();

create or replace function public.create_jkspeak_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.raw_user_meta_data ? 'learning_profile' then
   insert into public.learning_profiles(id, learning_profile) values (new.id, new.raw_user_meta_data->'learning_profile');
 end if;
 return new;
end;
$$;
revoke all on function public.create_jkspeak_profile() from public, anon, authenticated;
drop trigger if exists on_jkspeak_auth_user_created on auth.users;
create trigger on_jkspeak_auth_user_created after insert on auth.users for each row execute function public.create_jkspeak_profile();

commit;
