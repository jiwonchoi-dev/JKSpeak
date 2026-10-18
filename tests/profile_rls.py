"""Exercise the real SQL/RLS in isolated PostgreSQL; this is not a live Supabase test."""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
container = 'jkspeak-auth-test-' + uuid.uuid4().hex[:10]
subprocess.run(['docker','run','--rm','-d','--network','none','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],check=True,stdout=subprocess.DEVNULL)
try:
    for attempt in range(30):
        ready=subprocess.run(['docker','exec',container,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if ready.returncode==0: break
        time.sleep(1)
    else: raise RuntimeError('Test PostgreSQL did not start')
    def sql(text):
        subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],input=text.encode(),check=True)
    sql("""create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;""")
    migration=(ROOT/'supabase/migrations/202610180001_learning_profiles.sql').read_text()
    sql(migration)
    sql(migration)  # Migration is safe to reapply in this test project.
    sql((ROOT/'tests/profile_rls.sql').read_text())
finally:
    subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,check=True)
