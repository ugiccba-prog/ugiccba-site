begin;
-- Separate migration schema: does not modify pilot or original Sheets.

create schema mc_private;
create table mc_private.settings(id boolean primary key default true check(id),firebase_project text not null,owner_uid text not null,id_secret text not null,areas jsonb not null,mode text not null default 'preparing' check(mode in('preparing','ready','readonly')),import_hash text,import_expires timestamptz);
create table mc_private.users(uid text primary key,record jsonb not null);
create table mc_private.permission_history(id text primary key,event jsonb not null);
create table mc_private.activities(name text primary key,epoch integer not null default 1,version bigint not null default 0,projected_version bigint not null default -1,enabled boolean not null default false);
create table mc_private.records(activity text references mc_private.activities(name),kind text not null,key jsonb not null,data jsonb not null,primary key(activity,kind,key));
create table mc_private.fichas(activity text references mc_private.activities(name),id text not null,value jsonb not null,primary key(activity,id));
create table mc_private.versions(activity text references mc_private.activities(name),key text not null,revision bigint not null,primary key(activity,key));
create table mc_private.archives(activity text references mc_private.activities(name),id text not null,value jsonb not null,primary key(activity,id));
create table mc_private.receipts(activity text references mc_private.activities(name),id text not null,actor text not null,hash text not null,result jsonb not null,primary key(activity,id));
create table mc_private.audit(activity text references mc_private.activities(name),id text not null,event jsonb not null,primary key(activity,id));
create index mc_audit_page on mc_private.audit(activity,((event->>'version')::bigint) desc,id);
create table mc_private.identities(fingerprint text primary key,id text not null,status text not null);
create table mc_private.outbox(activity text primary key references mc_private.activities(name),version bigint not null,updated_at timestamptz not null default now());
create table mc_private.notices(uid text primary key references mc_private.users(uid),created_at timestamptz not null default now(),sent_at timestamptz);
create table mc_private.import_parts(unit text not null,part integer not null,total integer not null,body text not null,primary key(unit,part),check(part>=0 and part<total and total<=1000),check(octet_length(body)<=400000));
do $$declare t text;begin
 for t in select tablename from pg_tables where schemaname='mc_private' loop
  execute format('alter table mc_private.%I enable row level security',t);
  execute format('create policy deny_direct on mc_private.%I as restrictive for all to anon,authenticated using(false) with check(false)',t);
 end loop;
end$$;
revoke all on all tables in schema mc_private from public,anon,authenticated;
grant usage on schema mc_private to anon,authenticated,service_role;

-- This RPC must be called through PostgREST with Firebase JWT validation enabled.
-- It does not trust a uid supplied in the request body.
create function mc_private.identity() returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j jsonb:=auth.jwt();p text;begin
 select firebase_project into p from mc_private.settings where id;
 if p is null or j->>'iss' is distinct from 'https://securetoken.google.com/'||p or j->>'aud' is distinct from p or j->>'email_verified' is distinct from 'true' or j#>>'{firebase,sign_in_provider}' is distinct from 'google.com' or coalesce((j->>'exp')::numeric,0)<=extract(epoch from now()) or coalesce(j->>'sub','')='' or coalesce(j->>'email','')='' then
  raise exception using errcode='42501',message='Ingresá con una cuenta Google verificada.';
 end if;
 return jsonb_build_object('uid',j->>'sub','email',j->>'email','nombre',coalesce(j->>'name',j->>'email'));
end$$;
revoke all on function mc_private.identity() from public;
grant execute on function mc_private.identity() to anon,authenticated;
create function public.mc_identity() returns jsonb language sql security invoker set search_path='' as $$select mc_private.identity();$$;
revoke all on function public.mc_identity() from public;grant execute on function public.mc_identity() to anon,authenticated;

-- Service-only dispatcher. No browser/table access to unredacted state.
create function mc_private.service(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;u jsonb;a mc_private.activities%rowtype;r jsonb;state jsonb;old jsonb;v bigint;k text;rec record;d jsonb;uid text:=p->>'uid';name text:=p->>'activity';
begin
 select * into strict c from mc_private.settings where id;
 if p_action='touch' then
  select record into u from mc_private.users where mc_private.users.uid=uid;
  if u is null then
   if c.mode='preparing' then raise exception using errcode='PT409',message='La importación todavía está en curso.';end if;
   if p->>'allowCreate'<>'true' then raise exception using errcode='42501',message='Solicitá primero el acceso.';end if;
   u:=jsonb_build_object('uid',uid,'email',p->>'email','nombre',p->>'nombre','rol',case when uid=c.owner_uid then 'Dirección UGI' else 'Profe' end,'status',case when uid=c.owner_uid then 'activo' else 'pendiente' end,'areas',case when uid=c.owner_uid then c.areas else '[]'::jsonb end,'capabilities','{}'::jsonb,'version',1,'expiresAt',null);
   insert into mc_private.users values(uid,u) on conflict do nothing;
   insert into mc_private.notices(uid) select uid where uid<>c.owner_uid on conflict do nothing;
   select record into u from mc_private.users where mc_private.users.uid=uid;
  end if;
  return jsonb_build_object('user',u,'owner',c.owner_uid,'areas',c.areas,'mode',c.mode);
 end if;
 select record into u from mc_private.users where mc_private.users.uid=uid for share;
 if u is null or u->>'status'<>'activo' or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=now()) then raise exception using errcode='42501',message='Tu acceso está pendiente, suspendido o vencido.';end if;
 if p_action in('users','permissionHistory','updateUser') then
  if uid<>c.owner_uid then raise exception using errcode='42501',message='Sólo el propietario administra permisos.';end if;
  if p_action='users' then return jsonb_build_object('users',coalesce((select jsonb_agg(x.record order by x.uid) from (select * from mc_private.users order by mc_private.users.uid limit 50 offset coalesce((p->>'offset')::integer,0))x),'[]'::jsonb),'total',(select count(*) from mc_private.users));end if;
  if p_action='permissionHistory' then return jsonb_build_object('events',coalesce((select jsonb_agg(x.event) from(select event from mc_private.permission_history order by event->>'fecha' desc limit 100)x),'[]'::jsonb));end if;
  if p->>'target'=c.owner_uid then raise exception using errcode='42501',message='El propietario no se modifica desde el panel.';end if;
  select record into old from mc_private.users where mc_private.users.uid=p->>'target' for update;
  if old is null or (old->>'version')::bigint<>(p->>'revision')::bigint then raise exception using errcode='PT409',message='Los permisos cambiaron. Actualizá.';end if;
  r:=old||(p->'access')||jsonb_build_object('version',(old->>'version')::bigint+1);
  update mc_private.users set record=r where mc_private.users.uid=p->>'target';
  insert into mc_private.permission_history values(gen_random_uuid()::text,jsonb_build_object('fecha',now(),'uid',uid,'autor',u->>'nombre','usuario',p->>'target','antes',old,'despues',r));
  return jsonb_build_object('user',r,'authorizationUpdated',true);
 end if;
 select * into a from mc_private.activities where mc_private.activities.name=name for share;
 if a.name is null or not a.enabled then raise exception using errcode='PT409',message='Esta actividad todavía no fue migrada y verificada.';end if;
 if u->>'rol'<>'Dirección UGI' and not (coalesce(u->'areas','[]'::jsonb)?name) then raise exception using errcode='42501',message='No tenés acceso a esa actividad.';end if;
 if p_action='receipt' then
  select jsonb_build_object('actor',actor,'hash',hash,'result',result) into r from mc_private.receipts where activity=name and id=p->>'request';return coalesce(r,'null'::jsonb);
 end if;
 if p_action='audit' then
  if p->>'auditId' is not null then select event into r from mc_private.audit where activity=name and id=p->>'auditId';return coalesce(r,'null'::jsonb);end if;
  return coalesce((select jsonb_agg(x.event) from(select event from mc_private.audit where activity=name and (u->>'rol' in('Dirección UGI','Coordinación') or coalesce((u#>>'{capabilities,verLegajo}')::boolean,false) or event->>'uid'=uid) order by (event->>'version')::bigint desc,id limit 51 offset coalesce((p->>'offset')::integer,0))x),'[]'::jsonb);
 end if;
 if p_action='load' then
  if p->>'archive' is not null then
   select value->'state' into state from mc_private.archives where activity=name and id=p->>'archive';
   if state is null then raise exception 'Temporada inexistente.';end if;
  else
   state:=jsonb_build_object('padron','[]'::jsonb,'asistencia','[]'::jsonb,'evaluaciones','[]'::jsonb,'sesiones','[]'::jsonb,'gestos','[]'::jsonb,'email','','fichas','{}'::jsonb);
   for rec in select data from mc_private.records where activity=name and (p->>'scope' is null or kind='config' or kind='padron' and key=jsonb_build_array(p->>'category',p->>'team') or key=coalesce(p->'recordKey','null'::jsonb)) order by kind,key loop
    if rec.data->>'kind'='config' then state:=state||jsonb_build_object('gestos',rec.data->'gestos','email',rec.data->>'email');
    else k:=rec.data->>'kind';state:=jsonb_set(state,array[k],(state->k)||(rec.data->'rows'));end if;
   end loop;
   state:=jsonb_set(state,'{fichas}',coalesce((select jsonb_object_agg(f.id,f.value) from mc_private.fichas f where activity=name and (p->>'scope' is null or f.id in(select x->>'id' from jsonb_array_elements(state->'padron')x))),'{}'::jsonb));
  end if;
  return jsonb_build_object('state',state,'meta',jsonb_build_object('temporada',a.epoch,'version',a.version,'projectedVersion',a.projected_version),'versions',coalesce((select jsonb_object_agg(key,revision) from mc_private.versions where activity=name),'{}'::jsonb),'archives',coalesce((select jsonb_agg(value-'state' order by value->>'fecha' desc) from mc_private.archives where activity=name),'[]'::jsonb),'actor',u,'idSecret',c.id_secret,'identities',coalesce((select jsonb_agg(jsonb_build_array(fingerprint,id,status)) from mc_private.identities where fingerprint in(select encode(sha256(convert_to(c.id_secret||':'||j,'UTF8')),'hex') from jsonb_array_elements_text(coalesce(p->'dnis','[]'::jsonb))j)),'[]'::jsonb));
 end if;
 raise exception 'Acción interna desconocida.';
end$$;
revoke all on function mc_private.service(text,jsonb) from public,anon,authenticated;grant execute on function mc_private.service(text,jsonb) to service_role;
create function public.mc_service(p_action text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$select mc_private.service(p_action,p);$$;
revoke all on function public.mc_service(text,jsonb) from public,anon,authenticated;grant execute on function public.mc_service(text,jsonb) to service_role;

create function mc_private.commit(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;u jsonb;a mc_private.activities%rowtype;r jsonb;old jsonb;item jsonb;v bigint;rv bigint;newver bigint;ident mc_private.identities%rowtype;person jsonb;previous jsonb;fp text;name text:=p->>'activity';uid text:=p->>'uid';op jsonb:=p->'operation';
begin
 select * into strict c from mc_private.settings where id;
 if c.mode<>'ready' then raise exception using errcode='PT409',message='La migración está en revisión; no se admiten cambios.';end if;
 select record into u from mc_private.users where mc_private.users.uid=uid for share;
 if u is null or u->>'status'<>'activo' or u->>'rol'='Consulta' or (u->>'version')::bigint<>(p->>'actorVersion')::bigint or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=now()) then raise exception using errcode='42501',message='Tu autorización cambió o no permite guardar.';end if;
 if u->>'rol'<>'Dirección UGI' and not(coalesce(u->'areas','[]'::jsonb)?name) then raise exception using errcode='42501',message='No tenés acceso a esa actividad.';end if;
 -- Serialize only the short database commit, never an external network call.
 select * into strict a from mc_private.activities where mc_private.activities.name=name for update;
 if not a.enabled then raise exception using errcode='PT409',message='Actividad no verificada.';end if;
 select jsonb_build_object('actor',actor,'hash',hash,'result',result) into r from mc_private.receipts where activity=name and id=op->>'requestId';
 if r is not null then
  if r->>'actor'<>uid or r->>'hash'<>p->>'hash' then raise exception using errcode='PT409',message='Identificador ya utilizado por otra carga.';end if;
  return r->'result';
 end if;
 select revision into v from mc_private.versions where activity=name and key=p->>'resource';
 select revision into rv from mc_private.versions where activity=name and key=p->>'rosterKey';
 if a.epoch<>(op->>'temporada')::integer or coalesce(v,0)<>(op->>'revision')::bigint then raise exception using errcode='PT409',message='Otra persona modificó este registro o cambió la temporada. Actualizá y revisá la carga.';end if;
 if p->>'checkRoster'='true' and coalesce(rv,0)<>(op->>'rosterRevision')::bigint then raise exception using errcode='PT409',message='El padrón del grupo cambió. Actualizá antes de guardar.';end if;
 if op->>'tipo'='RESET_DATOS' and a.version<>(p->>'baseVersion')::bigint then raise exception using errcode='PT409',message='La actividad cambió antes del archivo. Actualizá.';end if;
 -- Compare selected documents to avoid lost updates across distinct resources.
 for item in select * from jsonb_array_elements(p->'changes') loop
  select data into old from mc_private.records where activity=name and kind=item->>'kind' and key=item->'key';
  if coalesce(old,'null'::jsonb) is distinct from item->'before' then return jsonb_build_object('retry',true);end if;
 end loop;
 for item in select * from jsonb_array_elements(p->'fichas') loop
  select value into old from mc_private.fichas where activity=name and id=item->>'id';
  if coalesce(old,'null'::jsonb) is distinct from item->'before' then return jsonb_build_object('retry',true);end if;
 end loop;
 -- Stable DNI identities remain private and are never silently reassigned.
 for item in select * from jsonb_array_elements(p->'changes') where value->>'kind'='padron' loop
  for person in select * from jsonb_array_elements(coalesce(item#>'{after,rows}','[]'::jsonb)) loop
   if coalesce(person->>'dni','')<>'' then
    fp:=encode(sha256(convert_to(c.id_secret||':'||(person->>'dni'),'UTF8')),'hex');
    select * into ident from mc_private.identities where fingerprint=fp for update;
    if ident.fingerprint is not null and (ident.id<>person->>'id' or ident.status='reservado' and not exists(select 1 from jsonb_array_elements(coalesce(item#>'{before,rows}','[]'::jsonb))b where b->>'id'=person->>'id' and b->>'dni'=person->>'dni')) then raise exception using errcode='PT409',message='El DNI tiene otra identidad o una rectificación pendiente. Dirección debe revisar.';end if;
    insert into mc_private.identities values(fp,person->>'id','activo') on conflict do nothing;
   end if;
  end loop;
  for previous in select * from jsonb_array_elements(coalesce(item#>'{before,rows}','[]'::jsonb)) loop
   if coalesce(previous->>'dni','')<>'' and exists(select 1 from jsonb_array_elements(coalesce(item#>'{after,rows}','[]'::jsonb))x where x->>'id'=previous->>'id' and x->>'dni' is distinct from previous->>'dni') then
    update mc_private.identities set status='reservado' where fingerprint=encode(sha256(convert_to(c.id_secret||':'||(previous->>'dni'),'UTF8')),'hex');
   end if;
  end loop;
 end loop;
 if p->'archive' is not null and p->'archive'<>'null'::jsonb then insert into mc_private.archives values(name,p#>>'{archive,id}',p->'archive');delete from mc_private.versions where activity=name;end if;
 for item in select * from jsonb_array_elements(p->'changes') loop
  if item->'after'='null'::jsonb then delete from mc_private.records where activity=name and kind=item->>'kind' and key=item->'key';
  else insert into mc_private.records values(name,item->>'kind',item->'key',item->'after') on conflict(activity,kind,key)do update set data=excluded.data;end if;
 end loop;
 for item in select * from jsonb_array_elements(p->'fichas') loop
  insert into mc_private.fichas values(name,item->>'id',item->'after') on conflict(activity,id)do update set value=excluded.value;
 end loop;
 insert into mc_private.versions values(name,p->>'resource',coalesce(v,0)+1) on conflict(activity,key)do update set revision=excluded.revision;
 if p->>'rosterChanged'='true' then insert into mc_private.versions values(name,p->>'rosterKey',coalesce(rv,0)+1) on conflict(activity,key)do update set revision=excluded.revision;end if;
 newver:=a.version+1;
 update mc_private.activities set version=newver,epoch=case when op->>'tipo'='RESET_DATOS' then epoch+1 else epoch end where mc_private.activities.name=name;
 insert into mc_private.audit values(name,op->>'requestId',(p->'audit')||jsonb_build_object('version',newver));
 r:=jsonb_build_object('ok',true,'apiVersion',2,'revision',coalesce(v,0)+1,'requestId',op->>'requestId','sheetsStatus','pending','temporada',case when op->>'tipo'='RESET_DATOS' then a.epoch+1 else a.epoch end);
 insert into mc_private.receipts values(name,op->>'requestId',uid,p->>'hash',r);
 insert into mc_private.outbox values(name,newver,now()) on conflict(activity)do update set version=excluded.version,updated_at=excluded.updated_at;
 return r;
end$$;
revoke all on function mc_private.commit(jsonb) from public,anon,authenticated;grant execute on function mc_private.commit(jsonb) to service_role;
create function public.mc_commit(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select mc_private.commit(p);$$;
revoke all on function public.mc_commit(jsonb) from public,anon,authenticated;grant execute on function public.mc_commit(jsonb) to service_role;


create function mc_private.import_part(p_secret text,p_unit text,p_part integer,p_total integer,p_checksum text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;prev mc_private.import_parts%rowtype;begin
 select * into strict c from mc_private.settings where id for update;
 if c.mode<>'preparing' or c.import_expires is null or c.import_expires<=now() or p_secret is null or p_secret !~ '^mci_[0-9a-f]{64}$' or c.import_hash is distinct from encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception using errcode='42501',message='Importación no autorizada o cerrada.';end if;
 if p_unit<>'global' and not(c.areas?p_unit) or p_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Unidad inválida.';end if;
 select * into prev from mc_private.import_parts where unit=p_unit and part=p_part;
 if prev.unit is not null then if prev.body<>p_body or prev.total<>p_total then raise exception using errcode='PT409',message='El origen cambió durante la exportación.';end if;return jsonb_build_object('ok',true,'duplicated',true);end if;
 if coalesce((select sum(octet_length(body)) from mc_private.import_parts),0)+octet_length(p_body)>100000000 then raise exception 'La importación supera el límite seguro de este ensayo.';end if;
 insert into mc_private.import_parts values(p_unit,p_part,p_total,p_body);
 return jsonb_build_object('ok',true,'part',p_part,'checksum',p_checksum);
end$$;
revoke all on function mc_private.import_part(text,text,integer,integer,text,text) from public;grant execute on function mc_private.import_part(text,text,integer,integer,text,text) to anon,authenticated;
create function public.mc_import_part(p_secret text,p_unit text,p_part integer,p_total integer,p_checksum text,p_body text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.import_part(p_secret,p_unit,p_part,p_total,p_checksum,p_body);$$;
revoke all on function public.mc_import_part(text,text,integer,integer,text,text) from public;grant execute on function public.mc_import_part(text,text,integer,integer,text,text) to anon,authenticated;
-- Finalization is service-only, never exposed to the export credential.
create function mc_private.import_unit(p_unit text,p_checksum text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare raw text;j jsonb;x record;row jsonb;kind text;keys text[];c mc_private.settings%rowtype;begin
 select * into strict c from mc_private.settings where id for update;
 if c.mode<>'preparing' then raise exception 'Importación cerrada.';end if;
 if (select count(*)<>max(total) or min(total)<>max(total) from mc_private.import_parts where unit=p_unit) is distinct from false then raise exception 'Faltan partes o el total no coincide.';end if;
 select string_agg(body,'' order by part) into raw from mc_private.import_parts where unit=p_unit;
 if encode(sha256(convert_to(raw,'UTF8')),'hex')<>p_checksum then raise exception 'La huella del origen no coincide.';end if;
 j:=raw::jsonb;
 if p_unit='global' then
  if j#>>'{config,owner}'<>c.owner_uid or j#>>'{config,project}'<>c.firebase_project or j#>'{config,areas}' is distinct from c.areas or length(j#>>'{config,idSecret}')<32 then raise exception 'Configuración de origen incorrecta.';end if;
  if exists(select 1 from mc_private.users) then raise exception 'Los usuarios ya fueron importados.';end if;
  update mc_private.settings set id_secret=j#>>'{config,idSecret}' where id;
  for row in select * from jsonb_array_elements(j#>'{users,users}') loop insert into mc_private.users values(row->>'uid',row);end loop;
  for x in select * from jsonb_each(j#>'{users,history}') loop insert into mc_private.permission_history values(x.key,x.value);end loop;
  for row in select * from jsonb_array_elements(j->'identities') loop insert into mc_private.identities values(row->>0,row->>1,row->>2);end loop;
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
revoke all on function mc_private.import_unit(text,text) from public,anon,authenticated;grant execute on function mc_private.import_unit(text,text) to service_role;
create function public.mc_import_unit(p_unit text,p_checksum text) returns jsonb language sql security invoker set search_path='' as $$select mc_private.import_unit(p_unit,p_checksum);$$;
revoke all on function public.mc_import_unit(text,text) from public,anon,authenticated;grant execute on function public.mc_import_unit(text,text) to service_role;


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