-- Read-only post-deployment checks. Expected: RLS true; browser privileges
-- false; all functions SECURITY INVOKER and restricted to service_role.
select c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('insurance_records','insurance_sessions','insurance_rate_buckets','insurance_clear_challenges');
select p.proname,p.prosecdef,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'insurance_%';
