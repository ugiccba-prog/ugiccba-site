begin;
create or replace function mc_private.service(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;u jsonb;a mc_private.activities%rowtype;r jsonb;state jsonb;old jsonb;v bigint;k text;rec record;d jsonb;uid text:=p->>'uid';name text:=p->>'activity';
begin
 select * into strict c from mc_private.settings where id;
 if p_action='touch' then
  select record into u from mc_private.users where mc_private.users.uid=uid;
  if u is null then
   if c.mode='preparing' then raise exception using errcode='PT409',message='La importación todavía está en curso.';end if;
   if p->>'allowCreate'<>'true' then raise exception using errcode='42501',message='Solicitá primero el acceso.';end if;
   u:=jsonb_build_object('uid',uid,'email',p->>'email','nombre',p->>'nombre','rol',case when uid=c.owner_uid then 'Dirección UGI' else 'Profe' end,'status',case when uid=c.owner_uid then 'activo' else 'pendiente' end,'areas',case when uid=c.owner_uid then c.areas else '[]'::jsonb end,'capabilities','{}'::jsonb,'version',gen_random_uuid()::text,'revision',0,'expiresAt',null);
   insert into mc_private.users values(uid,u) on conflict do nothing;
   if found then
    insert into mc_private.notices(uid) select uid where uid<>c.owner_uid on conflict do nothing;
    k:=gen_random_uuid()::text;insert into mc_private.permission_history values(k,jsonb_build_object('id',k,'fecha',now(),'actor',uid,'autor',u->>'nombre','target',u->>'email','antes',null,'despues',u,'motivo','Solicitud de acceso sin permisos'));
   end if;
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
  if old is null or coalesce((old->>'revision')::bigint,0)<>(p->>'revision')::bigint then raise exception using errcode='PT409',message='Los permisos cambiaron. Actualizá.';end if;
  r:=old||(p->'access')||jsonb_build_object('version',gen_random_uuid()::text,'revision',coalesce((old->>'revision')::bigint,0)+1);
  update mc_private.users set record=r where mc_private.users.uid=p->>'target';
  k:=gen_random_uuid()::text;insert into mc_private.permission_history values(k,jsonb_build_object('id',k,'fecha',now(),'actor',uid,'autor',u->>'nombre','target',old->>'email','antes',old,'despues',r));
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
create or replace function mc_private.commit(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;u jsonb;a mc_private.activities%rowtype;r jsonb;old jsonb;item jsonb;v bigint;rv bigint;newver bigint;ident mc_private.identities%rowtype;person jsonb;previous jsonb;fp text;name text:=p->>'activity';uid text:=p->>'uid';op jsonb:=p->'operation';
begin
 select * into strict c from mc_private.settings where id;
 if c.mode<>'ready' then raise exception using errcode='PT409',message='La migración está en revisión; no se admiten cambios.';end if;
 select record into u from mc_private.users where mc_private.users.uid=uid for share;
 if u is null or u->>'status'<>'activo' or u->>'rol'='Consulta' or (u->'version') is distinct from (p->'actorVersion') or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=now()) then raise exception using errcode='42501',message='Tu autorización cambió o no permite guardar.';end if;
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
commit;
