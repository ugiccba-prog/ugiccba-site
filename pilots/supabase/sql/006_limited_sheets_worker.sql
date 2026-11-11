-- PILOT ONLY: a revocable machine credential cannot access attendance writes.
begin;
create table mp_private.projection_credentials (
 id text primary key check (id='sheets-pilot'),
 secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
 active boolean not null default true,
 expires_at timestamptz not null
);
alter table mp_private.projection_credentials enable row level security;
create policy deny_direct on mp_private.projection_credentials as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mp_private.projection_credentials from public,anon,authenticated;
create function mp_private.mp_worker_auth(p_secret text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_secret is null or p_secret !~ '^mpw_[0-9a-f]{64}$' or not exists (
  select 1 from mp_private.projection_credentials where id='sheets-pilot' and active and expires_at>now()
  and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
 ) then raise exception using errcode='42501',message='Credencial del puente inválida o vencida.';end if;
end $$;
revoke all on function mp_private.mp_worker_auth(text) from public,anon,authenticated;
create function mp_private.mp_worker_jobs(p_secret text,p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform mp_private.mp_worker_auth(p_secret);return mp_private.mp_projection_jobs(p_limit);end $$;
create function mp_private.mp_worker_ack(p_secret text,p_requests uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
begin
 perform mp_private.mp_worker_auth(p_secret);
 if p_requests is null or cardinality(p_requests)>10 then raise exception 'Lote inválido.';end if;
 return mp_private.mp_projection_ack(p_requests);
end $$;
revoke all on function mp_private.mp_worker_jobs(text,integer),mp_private.mp_worker_ack(text,uuid[]) from public;
grant execute on function mp_private.mp_worker_jobs(text,integer),mp_private.mp_worker_ack(text,uuid[]) to anon,authenticated;
create function public.mp_worker_jobs(p_secret text,p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_worker_jobs(p_secret,p_limit);$$;
create function public.mp_worker_ack(p_secret text,p_requests uuid[]) returns integer language sql security invoker set search_path='' as $$select mp_private.mp_worker_ack(p_secret,p_requests);$$;
revoke all on function public.mp_worker_jobs(text,integer),public.mp_worker_ack(text,uuid[]) from public;
grant execute on function public.mp_worker_jobs(text,integer),public.mp_worker_ack(text,uuid[]) to anon,authenticated;
commit;
