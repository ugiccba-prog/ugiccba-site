begin;
create or replace function mc_private.service(p_action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c mc_private.settings%rowtype;u jsonb;a mc_private.activities%rowtype;r jsonb;state jsonb;old jsonb;k text;uid text:=p->>'uid';name text:=p->>'activity';
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
  elsif p->>'scope'='dashboard' then
   with rows_by_kind as (
    select s.kind,jsonb_agg(r.elem order by s.key,r.ord) as items
    from mc_private.records s
    cross join lateral jsonb_array_elements(coalesce(s.data->'rows','[]'::jsonb)) with ordinality as r(elem,ord)
    where s.activity=name and s.kind in('padron','asistencia','evaluaciones','sesiones')
    group by s.kind
   )
   select jsonb_build_object(
    'padron',coalesce((select items from rows_by_kind where kind='padron'),'[]'::jsonb),
    'asistencia',coalesce((select items from rows_by_kind where kind='asistencia'),'[]'::jsonb),
    'evaluaciones',coalesce((select items from rows_by_kind where kind='evaluaciones'),'[]'::jsonb),
    'sesiones',coalesce((select items from rows_by_kind where kind='sesiones'),'[]'::jsonb)
   ) into state;
   return jsonb_build_object('state',state,'actor',u);
  else
   with scoped as (
    select kind,key,data
    from mc_private.records
    where activity=name and (p->>'scope' is null or kind='config' or kind='padron' and key=jsonb_build_array(p->>'category',p->>'team') or key=coalesce(p->'recordKey','null'::jsonb))
   ),
   cfg as (
    select data->'gestos' as gestos,data->>'email' as email
    from scoped where kind='config' limit 1
   ),
   rows_by_kind as (
    select s.kind,jsonb_agg(r.elem order by s.key,r.ord) as items
    from scoped s
    cross join lateral jsonb_array_elements(coalesce(s.data->'rows','[]'::jsonb)) with ordinality as r(elem,ord)
    where s.kind in('padron','asistencia','evaluaciones','sesiones')
    group by s.kind
   )
   select jsonb_build_object(
    'padron',coalesce((select items from rows_by_kind where kind='padron'),'[]'::jsonb),
    'asistencia',coalesce((select items from rows_by_kind where kind='asistencia'),'[]'::jsonb),
    'evaluaciones',coalesce((select items from rows_by_kind where kind='evaluaciones'),'[]'::jsonb),
    'sesiones',coalesce((select items from rows_by_kind where kind='sesiones'),'[]'::jsonb),
    'gestos',coalesce((select gestos from cfg),'[]'::jsonb),
    'email',coalesce((select email from cfg),''),
    'fichas','{}'::jsonb
   ) into state;
   state:=jsonb_set(state,'{fichas}',coalesce((select jsonb_object_agg(f.id,f.value) from mc_private.fichas f where activity=name and (p->>'scope' is null or f.id in(select x->>'id' from jsonb_array_elements(state->'padron')x))),'{}'::jsonb));
  end if;
  return jsonb_build_object('state',state,'meta',jsonb_build_object('temporada',a.epoch,'version',a.version,'projectedVersion',a.projected_version),'versions',coalesce((select jsonb_object_agg(key,revision) from mc_private.versions where activity=name),'{}'::jsonb),'archives',coalesce((select jsonb_agg(value-'state' order by value->>'fecha' desc) from mc_private.archives where activity=name),'[]'::jsonb),'actor',u,'idSecret',c.id_secret,'identities',coalesce((select jsonb_agg(jsonb_build_array(fingerprint,id,status)) from mc_private.identities where fingerprint in(select encode(sha256(convert_to(c.id_secret||':'||j,'UTF8')),'hex') from jsonb_array_elements_text(coalesce(p->'dnis','[]'::jsonb))j)),'[]'::jsonb));
 end if;
 raise exception 'Acción interna desconocida.';
end$$;
commit;
