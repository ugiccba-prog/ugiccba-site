begin;
create table mc_private.sheet_targets(activity text primary key references mc_private.activities(name),sheet_id text not null unique);
alter table mc_private.sheet_targets enable row level security;
create policy deny_direct on mc_private.sheet_targets as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mc_private.sheet_targets from public,anon,authenticated;
create table mc_private.staging(activity text primary key references mc_private.activities(name),rows jsonb not null default '[]'::jsonb);
alter table mc_private.staging enable row level security;
create policy deny_direct on mc_private.staging as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mc_private.staging from public,anon,authenticated;
create function mc_private.sanitize(s jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('padron',coalesce((select jsonb_agg(x-'dni') from jsonb_array_elements(s->'padron')x),'[]'::jsonb),'asistencia',coalesce(s->'asistencia','[]'::jsonb),'evaluaciones',coalesce(s->'evaluaciones','[]'::jsonb),'gestos',coalesce(s->'gestos','[]'::jsonb),'fichas',coalesce((select jsonb_object_agg(key,jsonb_build_object('dua',value->'dua')) from jsonb_each(coalesce(s->'fichas','{}'::jsonb))where value?'dua'),'{}'::jsonb));
$$;
revoke all on function mc_private.sanitize(jsonb) from public,anon,authenticated;
create function mc_private.worker_jobs(p_secret text,p_limit integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare job record;s jsonb;rec record;out jsonb:='[]'::jsonb;hs jsonb;begin
 perform mp_private.mp_worker_auth(p_secret);
 for job in select o.activity,o.version,a.epoch,t.sheet_id from mc_private.outbox o join mc_private.activities a on a.name=o.activity left join mc_private.sheet_targets t on t.activity=o.activity order by o.updated_at limit greatest(0,least(p_limit,10)) for share of o,a loop
  s:=jsonb_build_object('padron','[]'::jsonb,'asistencia','[]'::jsonb,'evaluaciones','[]'::jsonb,'gestos','[]'::jsonb,'fichas','{}'::jsonb);
  for rec in select data from mc_private.records where activity=job.activity order by kind,key loop
   if rec.data->>'kind'='config' then s:=jsonb_set(s,'{gestos}',rec.data->'gestos');
   elsif rec.data->>'kind' in('padron','asistencia','evaluaciones') then s:=jsonb_set(s,array[rec.data->>'kind'],(s->(rec.data->>'kind'))||(rec.data->'rows'));end if;
  end loop;
  s:=jsonb_set(s,'{fichas}',coalesce((select jsonb_object_agg(id,value) from mc_private.fichas where activity=job.activity),'{}'::jsonb));
  hs:=coalesce((select jsonb_agg(jsonb_set(value,'{state}',mc_private.sanitize(value->'state'))) from mc_private.archives where activity=job.activity),'[]'::jsonb);
  out:=out||jsonb_build_array(jsonb_build_object('activity',job.activity,'version',job.version,'sheet_id',job.sheet_id,'epoch',job.epoch,'state',mc_private.sanitize(s),'archives',hs,'audit',coalesce((select jsonb_agg(event-'antes'-'despues'-'uid'-'rol') from mc_private.audit where activity=job.activity and event->>'tipo' in('ASISTENCIA','EVALUACION','RECONOCIMIENTO')),'[]'::jsonb)));
 end loop;return out;
end$$;
revoke all on function mc_private.worker_jobs(text,integer) from public;grant execute on function mc_private.worker_jobs(text,integer) to anon,authenticated;
create function public.mc_worker_jobs(p_secret text,p_limit integer default 5) returns jsonb language sql security invoker set search_path='' as $$select mc_private.worker_jobs(p_secret,p_limit);$$;
revoke all on function public.mc_worker_jobs(text,integer) from public;grant execute on function public.mc_worker_jobs(text,integer) to anon,authenticated;
create function mc_private.worker_ack(p_secret text,p_activity text,p_version bigint,p_sheet text,p_staging jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare previous text;begin
 perform mp_private.mp_worker_auth(p_secret);
 if p_sheet !~ '^[a-zA-Z0-9_-]{20,150}$' or p_version<0 or jsonb_typeof(p_staging)<>'array' or jsonb_array_length(p_staging)>500 then raise exception 'Destino o carga de nombres inválidos.';end if;
 perform 1 from mc_private.activities where name=p_activity for update;
 select sheet_id into previous from mc_private.sheet_targets where activity=p_activity;
 if previous is not null and previous<>p_sheet then raise exception 'No se cambia un destino existente automáticamente.';end if;
 if not exists(select 1 from mc_private.outbox where activity=p_activity and version>=p_version) then raise exception 'No existe ese trabajo pendiente.';end if;
 insert into mc_private.sheet_targets values(p_activity,p_sheet) on conflict do nothing;
 insert into mc_private.staging values(p_activity,p_staging) on conflict(activity)do update set rows=excluded.rows;
 update mc_private.activities set projected_version=greatest(projected_version,p_version) where name=p_activity;
 delete from mc_private.outbox where activity=p_activity and version=p_version;
 return jsonb_build_object('verified',true,'version',p_version,'activity',p_activity);
end$$;
revoke all on function mc_private.worker_ack(text,text,bigint,text,jsonb) from public;grant execute on function mc_private.worker_ack(text,text,bigint,text,jsonb) to anon,authenticated;
create function public.mc_worker_ack(p_secret text,p_activity text,p_version bigint,p_sheet text,p_staging jsonb default '[]'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select mc_private.worker_ack(p_secret,p_activity,p_version,p_sheet,p_staging);$$;
revoke all on function public.mc_worker_ack(text,text,bigint,text,jsonb) from public;grant execute on function public.mc_worker_ack(text,text,bigint,text,jsonb) to anon,authenticated;
create function mc_private.staging_rows(p_uid text,p_activity text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u jsonb;begin
 select record into u from mc_private.users where uid=p_uid;
 if u is null or u->>'status'<>'activo' or u->>'rol'='Consulta' or u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=now() or not(u->>'rol'='Dirección UGI' or coalesce(u->'areas','[]'::jsonb)?p_activity) then raise exception using errcode='42501',message='No tenés acceso.';end if;
 if not(coalesce((u#>>'{capabilities,administrarPadron}')::boolean,u->>'rol' in('Dirección UGI','Coordinación')))then raise exception using errcode='42501',message='No tenés permiso para importar.';end if;
 return coalesce((select rows from mc_private.staging where activity=p_activity),'[]'::jsonb);
end$$;
revoke all on function mc_private.staging_rows(text,text) from public,anon,authenticated;grant execute on function mc_private.staging_rows(text,text) to service_role;
create function public.mc_staging(p_uid text,p_activity text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.staging_rows(p_uid,p_activity);$$;
revoke all on function public.mc_staging(text,text) from public,anon,authenticated;grant execute on function public.mc_staging(text,text) to service_role;
commit;
