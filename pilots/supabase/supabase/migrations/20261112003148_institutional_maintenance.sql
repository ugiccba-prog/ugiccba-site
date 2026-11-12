begin;
create table mc_private.maintenance(id boolean primary key default true check(id),source_hash text not null,freeze_source boolean not null default false,export_nonce text,export_ack text,export_report jsonb,backup_report jsonb,backup_requested boolean not null default true);
alter table mc_private.maintenance enable row level security;
create policy deny_direct on mc_private.maintenance as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on mc_private.maintenance from public,anon,authenticated;
insert into mc_private.maintenance(id,source_hash) select true,import_hash from mc_private.settings where id and import_hash is not null;
alter table mc_private.notices add column status text not null default 'pending' check(status in('pending','sending','sent','review'));
create function mc_private.source_auth(p_secret text) returns void language plpgsql security definer set search_path='' as $$
begin if p_secret is null or p_secret !~ '^mci_[0-9a-f]{64}$' or not exists(select 1 from mc_private.maintenance where id and source_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')) then raise exception using errcode='42501',message='Mantenimiento no autorizado.';end if;end$$;
revoke all on function mc_private.source_auth(text) from public,anon,authenticated;
create function mc_private.source_tasks(p_secret text,p_result jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.maintenance%rowtype;s mc_private.settings%rowtype;begin
 perform mc_private.source_auth(p_secret);select * into strict s from mc_private.settings where id;
 select * into strict c from mc_private.maintenance where id for update;
 if p_result is not null then
  if p_result->>'exportNonce'=c.export_nonce then
   update mc_private.maintenance set export_report=p_result->'export',export_ack=case when p_result#>>'{export,ok}'='true' then c.export_nonce else export_ack end where id;
  end if;
  if p_result->'backup' is not null then update mc_private.maintenance set backup_report=p_result->'backup',backup_requested=false where id;end if;
  if p_result->'claim' is not null then update mc_private.notices set status='sending' where status='pending' and uid in(select jsonb_array_elements_text(p_result->'claim'));end if;
  if p_result->'review' is not null then update mc_private.notices set status='review' where uid in(select jsonb_array_elements_text(p_result->'review'));end if;
  if p_result->'sent' is not null then update mc_private.notices set sent_at=now(),status='sent' where uid in(select jsonb_array_elements_text(p_result->'sent'));end if;
 end if;
 return jsonb_build_object('freeze',c.freeze_source,'exportNonce',c.export_nonce,'exportAck',c.export_ack,'mode',s.mode,'ownerEmail',(select record->>'email' from mc_private.users where uid=s.owner_uid),'notices',coalesce((select jsonb_agg(jsonb_build_object('uid',n.uid,'nombre',u.record->>'nombre','email',u.record->>'email')) from mc_private.notices n join mc_private.users u using(uid) where n.sent_at is null and n.status='pending'),'[]'::jsonb),'backupRequested',(select backup_requested from mc_private.maintenance where id),'backup',coalesce((select backup_report from mc_private.maintenance where id),'null'::jsonb));
end$$;
revoke all on function mc_private.source_tasks(text,jsonb) from public;grant execute on function mc_private.source_tasks(text,jsonb) to anon,authenticated;
create function public.mc_source_tasks(p_secret text,p_result jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select mc_private.source_tasks(p_secret,p_result);$$;
revoke all on function public.mc_source_tasks(text,jsonb) from public;grant execute on function public.mc_source_tasks(text,jsonb) to anon,authenticated;
create function mc_private.backup(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare s mc_private.settings%rowtype;a mc_private.activities%rowtype;units jsonb;state jsonb;rec record;payload jsonb;begin
 perform mc_private.source_auth(p_secret);
 -- Acquire a consistent snapshot of all data and permissions in fixed order.
 perform 1 from mc_private.activities order by name for share;
 perform 1 from mc_private.users order by uid for share;
 select * into strict s from mc_private.settings where id;
 units:=jsonb_build_array(jsonb_build_object('unit','global','data',jsonb_build_object('config',jsonb_build_object('owner',s.owner_uid,'project',s.firebase_project,'idSecret',s.id_secret,'areas',s.areas),'users',jsonb_build_object('users',coalesce((select jsonb_agg(record order by uid) from mc_private.users),'[]'::jsonb),'history',coalesce((select jsonb_object_agg(id,event) from mc_private.permission_history),'{}'::jsonb)),'notices',coalesce((select jsonb_agg(to_jsonb(n) order by uid) from mc_private.notices n),'[]'::jsonb),'identities',coalesce((select jsonb_agg(jsonb_build_array(fingerprint,id,status) order by fingerprint) from mc_private.identities),'[]'::jsonb))));
 for a in select * from mc_private.activities order by name loop
  state:=jsonb_build_object('padron','[]'::jsonb,'asistencia','[]'::jsonb,'evaluaciones','[]'::jsonb,'sesiones','[]'::jsonb,'fichas','{}'::jsonb,'gestos','[]'::jsonb,'email','');
  for rec in select data from mc_private.records where activity=a.name order by kind,key loop
   if rec.data->>'kind'='config' then state:=state||jsonb_build_object('gestos',rec.data->'gestos','email',rec.data->>'email');else state:=jsonb_set(state,array[rec.data->>'kind'],(state->(rec.data->>'kind'))||(rec.data->'rows'));end if;
  end loop;
  state:=jsonb_set(state,'{fichas}',coalesce((select jsonb_object_agg(id,value) from mc_private.fichas where activity=a.name),'{}'::jsonb));
  payload:=jsonb_build_object('name',a.name,'state',state,'meta',jsonb_build_object('temporada',a.epoch,'version',a.version),'versions',coalesce((select jsonb_object_agg(key,revision) from mc_private.versions where activity=a.name),'{}'::jsonb),'audit',coalesce((select jsonb_object_agg(id,event) from mc_private.audit where activity=a.name),'{}'::jsonb),'archives',coalesce((select jsonb_object_agg(id,value) from mc_private.archives where activity=a.name),'{}'::jsonb),'receipts',coalesce((select jsonb_agg(jsonb_build_array(id,actor,hash,result::text) order by id) from mc_private.receipts where activity=a.name),'[]'::jsonb));
  units:=units||jsonb_build_array(jsonb_build_object('unit',a.name,'data',payload));
 end loop;
 return jsonb_build_object('format','MUNI360_SUPABASE_BACKUP_V1','createdAt',now(),'units',units);
end$$;
revoke all on function mc_private.backup(text) from public;grant execute on function mc_private.backup(text) to anon,authenticated;
create function public.mc_backup(p_secret text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.backup(p_secret);$$;
revoke all on function public.mc_backup(text) from public;grant execute on function public.mc_backup(text) to anon,authenticated;
-- Copy credentials retain their narrow access; only the original owner worker
-- can obtain a complete private backup or access notifications.
create function mc_private.worker_auth(p_secret text) returns void language plpgsql security definer set search_path='' as $$begin
 if left(coalesce(p_secret,''),4)='mci_' then perform mc_private.source_auth(p_secret);else perform mp_private.mp_worker_auth(p_secret);end if;end$$;
revoke all on function mc_private.worker_auth(text) from public,anon,authenticated;

create or replace function mc_private.worker_jobs(p_secret text,p_limit integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare job record;s jsonb;rec record;out jsonb:='[]'::jsonb;hs jsonb;begin
 perform mc_private.worker_auth(p_secret);
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

create or replace function mc_private.worker_ack(p_secret text,p_activity text,p_version bigint,p_sheet text,p_staging jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare previous text;begin
 perform mc_private.worker_auth(p_secret);
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
create or replace function mc_private.import_unit(p_unit text,p_checksum text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare raw text;j jsonb;x record;row jsonb;kind text;keys text[];c mc_private.settings%rowtype;begin
 select * into strict c from mc_private.settings where id for update;
 if c.mode<>'preparing' then raise exception 'Importación cerrada.';end if;
 if (select count(*)<>max(total) or min(total)<>max(total) from mc_private.import_parts where unit=p_unit) is distinct from false then raise exception 'Faltan partes o el total no coincide.';end if;
 select string_agg(body,'' order by part) into raw from mc_private.import_parts where unit=p_unit;
 if p_checksum is distinct from (select min(checksum) from mc_private.import_parts where unit=p_unit) or (select min(checksum)<>max(checksum) from mc_private.import_parts where unit=p_unit) or encode(sha256(convert_to(raw,'UTF8')),'hex')<>p_checksum then raise exception 'La huella del origen no coincide.';end if;
 j:=raw::jsonb;
 if p_unit='global' then
  if j#>>'{config,owner}'<>c.owner_uid or j#>>'{config,project}'<>c.firebase_project or j#>'{config,areas}' is distinct from c.areas or length(j#>>'{config,idSecret}')<32 then raise exception 'Configuración de origen incorrecta.';end if;
  if exists(select 1 from mc_private.users) then raise exception 'Los usuarios ya fueron importados.';end if;
  update mc_private.settings set id_secret=j#>>'{config,idSecret}' where id;
  for row in select * from jsonb_array_elements(j#>'{users,users}') loop insert into mc_private.users values(row->>'uid',row);end loop;
  for x in select * from jsonb_each(j#>'{users,history}') loop insert into mc_private.permission_history values(x.key,x.value);end loop;
  for row in select * from jsonb_array_elements(j->'identities') loop insert into mc_private.identities values(row->>0,row->>1,row->>2);end loop;
  for row in select * from jsonb_array_elements(coalesce(j->'notices','[]'::jsonb)) loop insert into mc_private.notices(uid,created_at,sent_at,status)values(row->>'uid',(row->>'created_at')::timestamptz,(row->>'sent_at')::timestamptz,coalesce(row->>'status','pending'));end loop;
  return jsonb_build_object('ok',true,'users',(select count(*) from mc_private.users));
 end if;
 if j->>'name'<>p_unit or not(c.areas?p_unit) or not exists(select 1 from mc_private.users where uid=c.owner_uid) then raise exception 'Origen o usuarios no verificados.';end if;
 insert into mc_private.activities(name,epoch,version) values(p_unit,(j#>>'{meta,temporada}')::integer,(j#>>'{meta,version}')::bigint);
 foreach kind in array array['padron','asistencia','evaluaciones','sesiones'] loop
  keys:=case kind when 'padron' then array['categoria','equipo'] when 'asistencia' then array['fecha','categoria','equipo'] when 'evaluaciones' then array['fecha','categoria','equipo','jugador'] else array['id'] end;
  insert into mc_private.records(activity,kind,key,data)
  select p_unit,kind,key,jsonb_build_object('kind',kind,'rows',jsonb_agg(value order by ord)) from (
   select value,ord,(select jsonb_agg(coalesce(value->>k,'') order by n) from unnest(keys) with ordinality q(k,n)) as key from jsonb_array_elements(j#>array['state',kind]) with ordinality z(value,ord)
  )grouped group by key;
 end loop;
 insert into mc_private.records values(p_unit,'config','[]'::jsonb,jsonb_build_object('kind','config','gestos',j#>'{state,gestos}','email',j#>>'{state,email}'));
 for x in select * from jsonb_each(j#>'{state,fichas}') loop insert into mc_private.fichas values(p_unit,x.key,x.value);end loop;
 for x in select * from jsonb_each(j->'versions') loop insert into mc_private.versions values(p_unit,x.key,(x.value#>>'{}')::bigint);end loop;
 for x in select * from jsonb_each(j->'audit') loop insert into mc_private.audit values(p_unit,x.key,x.value);end loop;
 for x in select * from jsonb_each(j->'archives') loop insert into mc_private.archives values(p_unit,x.key,x.value);end loop;
 for row in select * from jsonb_array_elements(j->'receipts') loop insert into mc_private.receipts values(p_unit,row->>0,row->>1,row->>2,(row->>3)::jsonb);end loop;
 for row in select * from jsonb_array_elements(j#>'{state,padron}') loop
  if coalesce(row->>'dni','')<>'' then
   if exists(select 1 from mc_private.identities where fingerprint=encode(sha256(convert_to(c.id_secret||':'||(row->>'dni'),'UTF8')),'hex') and id<>row->>'id') then raise exception 'El origen contiene una identidad de DNI incompatible.';end if;
   insert into mc_private.identities values(encode(sha256(convert_to(c.id_secret||':'||(row->>'dni'),'UTF8')),'hex'),row->>'id','activo') on conflict do nothing;
  end if;
 end loop;
 insert into mc_private.outbox(activity,version)values(p_unit,(j#>>'{meta,version}')::bigint);
 return jsonb_build_object('ok',true,'activity',p_unit,'roster',jsonb_array_length(j#>'{state,padron}'),'attendance',jsonb_array_length(j#>'{state,asistencia}'),'evaluations',jsonb_array_length(j#>'{state,evaluaciones}'));
end$$;
commit;
