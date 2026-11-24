begin;

create index users_normalized_email on mc_private.users (lower(btrim(record->>'email')));

create function mc_private.direct_access(p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 settings mc_private.settings%rowtype;
 target mc_private.users%rowtype;
 result jsonb;
 actor jsonb;
 new_record jsonb;
 access jsonb:=p->'access';
 login_uid text:=p->>'uid';
 email text:=lower(btrim(p->>'email'));
 event_id text;
begin
 if p_action='users' then
  result:=mc_private.service(p_action,p);
  return jsonb_set(result,'{users}',(
   select coalesce(jsonb_agg(item||jsonb_build_object('noticeStatus',notice.status) order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'users') with ordinality as entries(item,ord)
   left join lateral (
    select case when status='sending' and claimed_at<now()-interval '15 minutes' then 'review' else status end as status
    from mc_private.access_notices where uid=item->>'uid'
    order by created_at desc,id desc limit 1
   ) notice on true
  ));
 end if;

 if p_action='touch' then
  if login_uid like 'invite:%' then
   raise exception using errcode='42501',message='Ingresá con una cuenta Google verificada.';
  end if;
  -- Only the first verified Google login can claim a pre-authorized address.
  if p->>'allowCreate' is distinct from 'true' or email is null
    or exists(select 1 from mc_private.users where uid=login_uid) then
   return mc_private.service(p_action,p);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('muni360.direct_access:'||email,0));
  select * into strict settings from mc_private.settings where id;
  if settings.mode='ready' and login_uid<>settings.owner_uid
    and not exists(select 1 from mc_private.users where uid=login_uid) then
   select * into target from mc_private.users
   where lower(btrim(record->>'email'))=email and uid like 'invite:%'
   for update;
   if found then
    new_record:=(target.record-'awaitingLogin')||jsonb_build_object(
     'uid',login_uid,'nombre',coalesce(nullif(p->>'nombre',''),email),
     'revision',(target.record->>'revision')::bigint+1
    );
    insert into mc_private.users(uid,record) values(login_uid,new_record);
    update mc_private.access_notices set uid=login_uid where uid=target.uid;
    update mc_private.weekly_alerts set coordinator_uid=login_uid where coordinator_uid=target.uid;
    delete from mc_private.users where uid=target.uid;
   end if;
  end if;
  return mc_private.service(p_action,p);
 end if;

 if p_action is distinct from 'addUser' then
  raise exception using errcode='22023',message='Acción de acceso inválida.';
 end if;
 select * into strict settings from mc_private.settings where id;
 select record into actor from mc_private.users where uid=login_uid for share;
 if login_uid is distinct from settings.owner_uid or (actor->>'status') is distinct from 'activo'
   or (actor->>'expiresAt')::timestamptz<=now() then
  raise exception using errcode='42501',message='Sólo el propietario administra permisos.';
 end if;
 if settings.mode<>'ready' then
  raise exception using errcode='PT409',message='Muni360 está en mantenimiento.';
 end if;
 if email is null or char_length(email)>254 or email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
   or access->>'status' is distinct from 'activo'
   or coalesce(access->>'rol','') not in ('Profe','Coordinación','Consulta','Reemplazante')
   or not coalesce(jsonb_typeof(access->'areas')='array' and jsonb_array_length(access->'areas')>0
     and (access->'areas') <@ settings.areas,false)
   or (access->>'expiresAt')::timestamptz<=now()
   or (access->>'rol'='Reemplazante' and access->>'expiresAt' is null) then
  raise exception using errcode='22023',message='Revisá el correo y los permisos.';
 end if;

 perform pg_advisory_xact_lock(hashtextextended('muni360.direct_access:'||email,0));
 if (select count(*) from mc_private.users where lower(btrim(record->>'email'))=email)>1 then
  raise exception using errcode='PT409',message='Hay más de un usuario con este correo. Revisá el listado.';
 end if;
 select * into target from mc_private.users
 where lower(btrim(record->>'email'))=email;
 if found then
  if target.uid=settings.owner_uid or target.uid like 'invite:%' or (target.record->>'status') is distinct from 'pendiente' then
   raise exception using errcode='PT409',message='El correo ya está en Usuarios y permisos. Usá Revisar acceso.';
  end if;
  return mc_private.service('updateUser',jsonb_build_object(
    'uid',login_uid,'target',target.uid,'revision',target.record->'revision','access',access
  ));
 end if;

 target.uid:='invite:'||gen_random_uuid()::text;
 new_record:=access||jsonb_build_object(
  'uid',target.uid,'email',email,'nombre',email,'awaitingLogin',true,
  'version',gen_random_uuid()::text,'revision',0
 );
 insert into mc_private.users(uid,record) values(target.uid,new_record);
 insert into mc_private.access_notices(uid,authorization_version) values(target.uid,new_record->>'version');
 event_id:=gen_random_uuid()::text;
 insert into mc_private.permission_history(id,event) values(event_id,jsonb_build_object(
  'id',event_id,'fecha',now(),'actor',login_uid,'autor',actor->>'nombre','target',email,
  'antes',null,'despues',new_record,'motivo','Alta directa por correo'
 ));
 return jsonb_build_object('user',new_record,'authorizationUpdated',true);
end$$;
revoke all on function mc_private.direct_access(text,jsonb) from public,anon,authenticated;
grant execute on function mc_private.direct_access(text,jsonb) to service_role;

create or replace function public.mc_service(p_action text,p jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select case when p_action in ('touch','users','addUser') then mc_private.direct_access(p_action,p)
 else mc_private.service(p_action,p) end;
$$;
revoke all on function public.mc_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.mc_service(text,jsonb) to service_role;

commit;
