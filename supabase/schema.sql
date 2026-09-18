-- Fresh installation or upgrade from the supplied prototype.
-- Never run this against unrelated tables. Existing prototype ciphertext must
-- be migrated with its ORIGINAL encryption key before using key_version=1.
begin;
create table if not exists public.insurance_records (
  idno_hash text primary key,
  payload_ciphertext text not null,
  payload_iv text not null,
  updated_at timestamptz not null default now()
);
alter table public.insurance_records add column if not exists key_version integer not null default 0;
-- New writes use AES-GCM AAD + HMAC index, version 1.
create table if not exists public.insurance_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
create index if not exists insurance_sessions_expiry on public.insurance_sessions(expires_at);
create table if not exists public.insurance_rate_buckets (
  bucket text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
create index if not exists insurance_rate_expiry on public.insurance_rate_buckets(expires_at);
create table if not exists public.insurance_clear_challenges (
  token_hash text primary key,
  snapshot text not null,
  expires_at timestamptz not null
);
alter table public.insurance_records enable row level security;
alter table public.insurance_sessions enable row level security;
alter table public.insurance_rate_buckets enable row level security;
alter table public.insurance_clear_challenges enable row level security;
revoke all on public.insurance_records,public.insurance_sessions,public.insurance_rate_buckets,public.insurance_clear_challenges from public,anon,authenticated;
grant select,insert,update,delete on public.insurance_records,public.insurance_sessions,public.insurance_rate_buckets,public.insurance_clear_challenges to service_role;

create or replace function public.insurance_rate_limit(p_bucket text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_attempts integer;
begin
  if length(p_bucket)>160 or p_limit<1 or p_seconds<1 then raise exception 'invalid rate bucket'; end if;
  delete from public.insurance_rate_buckets where expires_at < now()-interval '1 day';
  insert into public.insurance_rate_buckets as b(bucket,attempts,expires_at)
  values(p_bucket,1,now()+make_interval(secs=>p_seconds))
  on conflict(bucket) do update set
    attempts=case when b.expires_at<=now() then 1 else least(b.attempts+1,p_limit+1) end,
    expires_at=case when b.expires_at<=now() then now()+make_interval(secs=>p_seconds) else b.expires_at end
  returning attempts into v_attempts;
  return v_attempts<=p_limit;
end $$;

create or replace function public.insurance_session_create(p_hash text)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare v_expiry timestamptz:=now()+interval '1 hour';
begin
  delete from public.insurance_sessions where expires_at<=now();
  insert into public.insurance_sessions values(p_hash,v_expiry);
  return v_expiry;
end $$;
create or replace function public.insurance_session_valid(p_hash text)
returns boolean language sql security invoker set search_path='' as $$
  select exists(select 1 from public.insurance_sessions where token_hash=p_hash and expires_at>now());
$$;
create or replace function public.insurance_session_delete(p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  delete from public.insurance_sessions where token_hash=p_hash;
  return true;
end $$;

create or replace function public.insurance_upsert(p_hash text,p_ciphertext text,p_iv text,p_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_inserted boolean;
begin
  if p_hash !~ '^[a-f0-9]{64}$' or p_version<>1 or length(p_iv)<>16 or length(p_ciphertext)>16384 then raise exception 'invalid encrypted record'; end if;
  insert into public.insurance_records(idno_hash,payload_ciphertext,payload_iv,key_version,updated_at)
  values(p_hash,p_ciphertext,p_iv,p_version,clock_timestamp())
  on conflict(idno_hash) do update set
    payload_ciphertext=excluded.payload_ciphertext,payload_iv=excluded.payload_iv,
    key_version=excluded.key_version,updated_at=clock_timestamp()
  returning (xmax=0) into v_inserted;
  return jsonb_build_object('updated',not v_inserted);
end $$;

-- One JSON scalar produces a consistent snapshot without PostgREST's row cap.
create or replace function public.insurance_stats_snapshot()
returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at,r.idno_hash),'[]'::jsonb)
  from public.insurance_records r;
$$;

create or replace function public.insurance_prepare_clear(p_hash text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_snapshot text; v_count bigint;
begin
  delete from public.insurance_clear_challenges where expires_at<=now();
  select md5(coalesce(string_agg(idno_hash||payload_ciphertext,'' order by idno_hash),'')),count(*)
  into v_snapshot,v_count from public.insurance_records;
  insert into public.insurance_clear_challenges values(p_hash,v_snapshot,now()+interval '60 seconds');
  return v_count;
end $$;

create or replace function public.insurance_clear(p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_expected text; v_current text; v_deleted bigint;
begin
  -- Serializes deletion with concurrent submissions. Changed data invalidates
  -- confirmation rather than silently deleting a newly submitted traveler.
  lock table public.insurance_records in share row exclusive mode;
  delete from public.insurance_clear_challenges
    where token_hash=p_hash and expires_at>now() returning snapshot into v_expected;
  if v_expected is null then return jsonb_build_object('ok',false); end if;
  select md5(coalesce(string_agg(idno_hash||payload_ciphertext,'' order by idno_hash),'')) into v_current from public.insurance_records;
  if v_expected<>v_current then return jsonb_build_object('ok',false); end if;
  delete from public.insurance_records;
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'deleted',v_deleted);
end $$;

revoke all on function public.insurance_rate_limit(text,integer,integer),public.insurance_session_create(text),public.insurance_session_valid(text),public.insurance_session_delete(text),public.insurance_upsert(text,text,text,integer),public.insurance_stats_snapshot(),public.insurance_prepare_clear(text),public.insurance_clear(text) from public,anon,authenticated;
grant execute on function public.insurance_rate_limit(text,integer,integer),public.insurance_session_create(text),public.insurance_session_valid(text),public.insurance_session_delete(text),public.insurance_upsert(text,text,text,integer),public.insurance_stats_snapshot(),public.insurance_prepare_clear(text),public.insurance_clear(text) to service_role;
notify pgrst,'reload schema';
commit;
