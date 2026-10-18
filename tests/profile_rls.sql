-- Uses synthetic accounts only. Executed after the migration in isolated PostgreSQL.
insert into auth.users(id, raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111', '{"learning_profile":{"version":1,"displayName":"One","course":"Physics","examFormat":"oral","englishLevel":"B2","focus":"evidence","preferredMinutes":10,"weeklyGoal":3,"answerPreference":"both","examDate":"","goal":"Explain clearly","challenges":[],"timezone":"UTC","aiConsent":false}}'),
('22222222-2222-4222-8222-222222222222', '{"learning_profile":{"version":1,"displayName":"Two","course":"Chemistry","examFormat":"viva","englishLevel":"unsure","focus":"reasoning","preferredMinutes":15,"weeklyGoal":2,"answerPreference":"type","examDate":"","goal":"","challenges":["followups"],"timezone":"UTC","aiConsent":false}}');

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
declare n integer;
begin
 select count(*) into n from public.learning_profiles;
 if n <> 1 then raise exception 'RLS leaked another account'; end if;
 select count(*) into n from public.learning_profiles where id='22222222-2222-4222-8222-222222222222';
 if n <> 0 then raise exception 'RLS leaked a targeted account'; end if;
 update public.learning_profiles set learning_profile=jsonb_set(learning_profile,'{aiConsent}','true'), created_at='2000-01-01';
 if not (select (learning_profile->>'aiConsent')::boolean from public.learning_profiles) then raise exception 'Owner could not save profile'; end if;
 if (select created_at < '2020-01-01' from public.learning_profiles) then raise exception 'Client overrode server timestamp'; end if;
 update public.learning_profiles set learning_profile=jsonb_set(learning_profile,'{course}','"Hacked"') where id='22222222-2222-4222-8222-222222222222';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'RLS allowed cross-account update'; end if;
 begin
   update public.learning_profiles set id='22222222-2222-4222-8222-222222222222';
   raise exception 'Owner ID change was allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.learning_profiles set learning_profile=learning_profile || '{"password":"must-not-be-in-profile"}';
   raise exception 'Schema accepted credentials in learning data';
 exception when check_violation then null;
 end;
end;
$$;

reset role;
set role anon;
do $$
begin
 begin
   perform * from public.learning_profiles;
   raise exception 'Anonymous profile access was allowed';
 exception when insufficient_privilege then null;
 end;
end;
$$;
reset role;

-- A real auth-user deletion cascades to profile data.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
do $$begin
 if exists(select 1 from public.learning_profiles where id='11111111-1111-4111-8111-111111111111') then raise exception 'Orphaned profile'; end if;
end;$$;
select 'PASS: signup trigger; own read/write; cross-account read/write denied; owner/timestamp protection; credential fields rejected; anonymous denied; deletion cascade';
