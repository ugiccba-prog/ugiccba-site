begin;

-- Team assignments and player links live on the access record. Existing records
-- have no assignments until Dirección or Coordinación grants them explicitly.
create function public.mc_team_access(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 config mc_private.settings%rowtype;
 caller jsonb;
 teacher jsonb;
 updated jsonb;
 groups jsonb;
 roster jsonb;
 teachers jsonb;
 is_owner boolean;
 event_id text;
 actor_uid text:=p->>'actorUid';
 target_uid text:=p->>'targetUid';
 sport text:=p->>'activity';
 requested jsonb:=p->'teams';
 player_id jsonb:=p->'playerId';
 group_choice jsonb:=p->'team';
 changes jsonb:=p->'changes';
 change jsonb;
 next_teams jsonb;
begin
 select * into strict config from mc_private.settings where id;
 select record into caller from mc_private.users where uid=actor_uid for share;
 is_owner:=actor_uid is not distinct from config.owner_uid;
 if coalesce(caller->>'status','')<>'activo' or (caller->>'expiresAt')::timestamptz<=now()
    or not (is_owner or coalesce(caller->>'rol','')='Coordinación')
    or not coalesce(config.areas ? sport,false) or sport in ('Colonia','COYFD')
    or not (is_owner or coalesce((caller->'areas') ? sport,false)) then
  raise exception using errcode='42501',message='Actividad fuera de tu alcance.';
 end if;

 select coalesce(jsonb_agg(
  jsonb_build_object('categoria',r.key->>0,'equipo',r.key->>1)
  order by r.key->>0,r.key->>1),'[]'::jsonb) into groups
 from mc_private.records r
 where r.activity=sport and r.kind='padron' and jsonb_array_length(r.key)=2
   and jsonb_array_length(r.data->'rows')>0;

 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object(
   'uid',u.uid,'nombre',u.record->>'nombre','email',u.record->>'email','revision',u.record->'revision',
   'teams',coalesce(u.record->'teams'->sport,'[]'::jsonb),
   'reviewed',coalesce((u.record->'playerLinks') ? sport,false)
  ) || case when is_owner then jsonb_build_object('playerId',u.record->'playerLinks'->sport) else '{}'::jsonb end
   order by u.record->>'nombre',u.uid),'[]'::jsonb) into teachers
  from mc_private.users u
  where u.uid not like 'invite:%' and u.record->>'rol'='Profe' and u.record->>'status'='activo'
    and (u.record->'areas') ? sport
    and (u.record->>'expiresAt' is null or (u.record->>'expiresAt')::timestamptz>now());
  if is_owner then
   select coalesce(jsonb_agg(player order by player->>'nombre',player->>'categoria',player->>'equipo'),'[]'::jsonb) into roster
   from (
    select distinct jsonb_build_object('id',entry->>'id','nombre',entry->>'jugador',
     'categoria',entry->>'categoria','equipo',entry->>'equipo') as player
    from mc_private.records r cross join lateral jsonb_array_elements(r.data->'rows') entry
    where r.activity=sport and r.kind='padron' and entry->>'id'<>''
   ) linked;
  end if;
  return jsonb_build_object('teams',groups,'teachers',teachers,'players',coalesce(roster,'[]'::jsonb),'canLinkPlayer',is_owner);
 end if;

 if config.mode<>'ready' then
  raise exception using errcode='PT409',message='Muni360 está en mantenimiento.';
 end if;
 if p_action='saveTeam' then
  if jsonb_typeof(changes) is distinct from 'array' or
    not exists(select 1 from jsonb_array_elements(groups) entry where entry=group_choice) then
   raise exception using errcode='22023',message='Revisá el equipo y los profesores.';
  end if;
  if jsonb_array_length(changes)>200 then
   raise exception using errcode='22023',message='Demasiados profesores para una sola asignación.';
  end if;
  -- All changes share the same SQL transaction. A conflict rolls back the whole selection.
  for change in select value from jsonb_array_elements(changes) order by value->>'uid' loop
   if jsonb_typeof(change->'assigned') is distinct from 'boolean' then
    raise exception using errcode='22023',message='Asignación inválida.';
   end if;
   target_uid:=change->>'uid';
   select record into teacher from mc_private.users where uid=target_uid for update;
   select coalesce(jsonb_agg(entry),'[]'::jsonb) into next_teams
     from jsonb_array_elements(coalesce(teacher->'teams'->sport,'[]'::jsonb)) entry
     where entry<>group_choice;
   if (change->>'assigned')::boolean then
    next_teams:=next_teams||jsonb_build_array(group_choice);
   end if;
   perform public.mc_team_access('save',jsonb_build_object(
    'actorUid',actor_uid,'activity',sport,'targetUid',target_uid,
    'revision',change->'revision','teams',next_teams));
  end loop;
  return jsonb_build_object('updated',jsonb_array_length(changes));
 end if;
 if p_action is null or p_action not in ('save','player') or (p_action='player' and not is_owner) then
  raise exception using errcode='42501',message='Acción de asignación no autorizada.';
 end if;
 select record into teacher from mc_private.users where uid=target_uid for update;
 if target_uid like 'invite:%' or coalesce(teacher->>'rol','')<>'Profe' or coalesce(teacher->>'status','')<>'activo'
    or not coalesce((teacher->'areas') ? sport,false) or (teacher->>'expiresAt')::timestamptz<=now() then
  raise exception using errcode='42501',message='La cuenta Profe no está activa para esta actividad.';
 end if;
 if p->'revision' is distinct from teacher->'revision' then
  raise exception using errcode='PT409',message='La asignación cambió. Actualizá el listado.';
 end if;

 if p_action='save' then
  if jsonb_typeof(requested) is distinct from 'array' then
   raise exception using errcode='22023',message='Elegí los equipos del padrón.';
  end if;
  if jsonb_array_length(requested)>500 or exists (
   select 1 from jsonb_array_elements(requested) choice
   where not exists (select 1 from jsonb_array_elements(groups) available where available=choice)
     and not exists (select 1 from jsonb_array_elements(coalesce(teacher->'teams'->sport,'[]'::jsonb)) previous where previous=choice)
  ) then
   raise exception using errcode='22023',message='Elegí los equipos del padrón.';
  end if;
  select coalesce(jsonb_agg(item order by item->>'categoria',item->>'equipo'),'[]'::jsonb)
    into requested from (select distinct value as item from jsonb_array_elements(requested)) selected;
  updated:=jsonb_set(teacher,'{teams}',coalesce(teacher->'teams','{}'::jsonb)||jsonb_build_object(sport,requested));
 else
  if player_id is null or jsonb_typeof(player_id) not in ('null','string') then
   raise exception using errcode='22023',message='Elegí una ficha o confirmá que no juega en esta actividad.';
  end if;
  if player_id<>'null'::jsonb and not exists (
   select 1 from mc_private.records r cross join lateral jsonb_array_elements(r.data->'rows') entry
   where r.activity=sport and r.kind='padron' and entry->'id'=player_id
  ) then
   raise exception using errcode='22023',message='La ficha seleccionada no pertenece a esta actividad.';
  end if;
  updated:=jsonb_set(teacher,'{playerLinks}',coalesce(teacher->'playerLinks','{}'::jsonb)||jsonb_build_object(sport,player_id));
 end if;
 if updated=teacher then return jsonb_build_object('revision',teacher->'revision'); end if;
 updated:=updated||jsonb_build_object('revision',(teacher->>'revision')::bigint+1,'version',gen_random_uuid()::text);
 update mc_private.users set record=updated where uid=target_uid;
 event_id:=gen_random_uuid()::text;
 insert into mc_private.permission_history values(event_id,jsonb_build_object(
  'id',event_id,'fecha',now(),'actor',actor_uid,'autor',caller->>'nombre','target',teacher->>'email',
  'antes',teacher,'despues',updated,'actividad',sport,
  'motivo',case when p_action='save' then 'Asignación de equipos' else 'Verificación de ficha deportiva' end
 ));
 return jsonb_build_object('revision',updated->'revision');
end;
$$;
revoke all on function public.mc_team_access(text,jsonb) from public,anon,authenticated;
grant execute on function public.mc_team_access(text,jsonb) to service_role;

-- Observations are internal and excluded from institutional spreadsheet views.
create or replace function mc_private.sanitize(s jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('padron',coalesce((select jsonb_agg(x-'dni') from jsonb_array_elements(s->'padron')x),'[]'::jsonb),'asistencia',coalesce(s->'asistencia','[]'::jsonb),'evaluaciones',coalesce((select jsonb_agg(item.value-'observacion' order by item.ord)
   from jsonb_array_elements(coalesce(s->'evaluaciones','[]'::jsonb)) with ordinality as item(value,ord)),'[]'::jsonb),'gestos',coalesce(s->'gestos','[]'::jsonb),'fichas',coalesce((select jsonb_object_agg(key,jsonb_build_object('dua',value->'dua')) from jsonb_each(coalesce(s->'fichas','{}'::jsonb))where value?'dua'),'{}'::jsonb));
$$;

commit;
