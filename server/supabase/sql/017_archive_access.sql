begin;

create or replace function mc_private.manage_user_archive(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_uid text;
 actor jsonb;
 target mc_private.users%rowtype;
 previous jsonb;
 updated jsonb;
 event_id text;
 actor_uid text:=p->>'uid';
 archive_view boolean:=coalesce((p->>'archived')::boolean,false);
begin
 select settings.owner_uid into strict owner_uid from mc_private.settings where id;
 select record into actor from mc_private.users where uid=actor_uid for share;
 if actor_uid is distinct from owner_uid or (actor->>'status') is distinct from 'activo'
   or (actor->>'expiresAt')::timestamptz<=now() then
  raise exception using errcode='42501',message='Sólo el propietario administra permisos.';
 end if;

 if p_action='users' then
  return jsonb_build_object(
   'users',coalesce((
    select jsonb_agg(users_page.record||jsonb_build_object('noticeStatus',notice.status) order by users_page.uid)
    from (
     select uid,record from mc_private.users
     where (record ? 'archivedAt')=archive_view
     order by uid limit 200 offset coalesce((p->>'offset')::integer,0)
    ) users_page
    left join lateral (
     select case when status='sending' and claimed_at<now()-interval '15 minutes' then 'review' else status end as status
     from mc_private.access_notices where uid=users_page.uid
     order by created_at desc,id desc limit 1
    ) notice on true
   ),'[]'::jsonb),
   'total',(select count(*) from mc_private.users where (record ? 'archivedAt')=archive_view)
  );
 end if;

 if p->>'target'=owner_uid then
  raise exception using errcode='42501',message='El propietario no se modifica desde el panel.';
 end if;
 select * into target from mc_private.users where uid=p->>'target' for update;
 previous:=target.record;
 if previous is null or coalesce((previous->>'revision')::bigint,0) is distinct from (p->>'revision')::bigint then
  raise exception using errcode='PT409',message='Los permisos cambiaron. Actualizá.';
 end if;

 if p_action='updateUser' then
  if previous ? 'archivedAt' then
   raise exception using errcode='PT409',message='Restaurá el acceso antes de editar sus permisos.';
  end if;
  return mc_private.service(p_action,p);
 end if;

 if archive_view then
  if previous ? 'archivedAt' then
   raise exception using errcode='PT409',message='El acceso ya está archivado.';
  end if;
  if previous->>'status'='activo' and coalesce((previous->>'expiresAt')::timestamptz>now(),true) then
   raise exception using errcode='PT409',message='Suspendé el acceso vigente antes de archivarlo.';
  end if;
  updated:=previous||jsonb_build_object('archivedAt',now());
 else
  if not (previous ? 'archivedAt') then
   raise exception using errcode='PT409',message='El acceso ya está en el listado principal.';
  end if;
  updated:=previous-'archivedAt';
 end if;
 updated:=updated||jsonb_build_object('status','suspendido','version',gen_random_uuid()::text,'revision',(p->>'revision')::bigint+1);
 update mc_private.users set record=updated where uid=target.uid;
 event_id:=gen_random_uuid()::text;
 insert into mc_private.permission_history(id,event) values(event_id,jsonb_build_object(
  'id',event_id,'fecha',now(),'actor',actor_uid,'autor',actor->>'nombre','target',previous->>'email',
  'antes',previous,'despues',updated,'motivo',case when archive_view then 'Acceso archivado' else 'Acceso restaurado como suspendido' end
 ));
 return jsonb_build_object('user',updated,'authorizationUpdated',true);
end$$;
revoke all on function mc_private.manage_user_archive(text,jsonb) from public,anon,authenticated;
grant execute on function mc_private.manage_user_archive(text,jsonb) to service_role;

create or replace function public.mc_service(p_action text,p jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select case
  when p_action in ('users','updateUser','archiveUser') then mc_private.manage_user_archive(p_action,p)
  when p_action in ('touch','addUser') then mc_private.direct_access(p_action,p)
  else mc_private.service(p_action,p)
 end;
$$;

commit;
