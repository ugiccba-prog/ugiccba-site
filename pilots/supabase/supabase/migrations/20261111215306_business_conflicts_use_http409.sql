-- Business conflicts must not use the retryable serialization_failure code.
begin;
create or replace function mp_private.mp_save_attendance(p_request uuid,p_group uuid,p_day date,p_season integer,p_roster_revision integer,p_revision integer,p_rows jsonb,p_climate text default 'N',p_points integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a mp_private.principals; g mp_private.groups; s mp_private.sessions; prior mp_private.receipts;
        payload jsonb; result jsonb; before_rows jsonb; after_rows jsonb; count_rows integer; count_ids integer; expected integer;
begin
  a:=mp_private.actor();
  if a.role='Consulta' then raise exception using errcode='42501',message='PERMISOS: Tu acceso es de consulta.'; end if;
  select * into g from mp_private.groups where id=p_group for share;
  if not found or not(g.activity=any(a.activities)) then raise exception using errcode='42501',message='PERMISOS: Actividad no habilitada.'; end if;
  if p_request is null or p_day is null or p_revision is null or p_revision<0 or p_season is null or p_roster_revision is null
     or p_climate is null or p_climate not in ('N','Vapor','Fuego','Agua') or (p_points is not null and (p_points<0 or p_points>999)) then raise exception 'VALIDACION: Carga incompleta o inválida.'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'VALIDACION: Lista requerida.'; end if;
  if jsonb_array_length(p_rows)>500 then raise exception 'VALIDACION: Máximo 500 participantes por grupo.'; end if;
  payload:=jsonb_build_object('group_id',p_group,'day',p_day,'season',p_season,'roster_revision',p_roster_revision,'revision',p_revision,'rows',p_rows,'climate',p_climate,'points',p_points);
  -- Per-request lock, NOT a global lock. Serializes an ambiguous retry only.
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select * into prior from mp_private.receipts where request_id=p_request;
  if found then
    if prior.actor<>a.subject or prior.payload<>payload then raise exception using errcode='PT409',message='CONFLICTO: Identificador usado con otra carga.'; end if;
    return prior.result;
  end if;
  if p_season<>g.season or p_roster_revision<>g.roster_revision then raise exception using errcode='PT409',message='CONFLICTO: Cambió el padrón o la temporada.'; end if;
  select count(*),count(distinct x->>'id') into count_rows,count_ids from jsonb_array_elements(p_rows) x;
  select count(*) into expected from mp_private.athletes where group_id=g.id;
  if expected=0 or count_rows<>expected or count_ids<>expected or exists(
    select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object' or x->>'state' is null or x->>'state' not in ('N','P','A','T')
      or x->>'semaphore' is null or x->>'semaphore' not in ('N','V','A','R') or jsonb_typeof(x->'food') is distinct from 'boolean'
      or not exists(select 1 from mp_private.athletes p where p.group_id=g.id and p.id::text=x->>'id')
      or ((x->>'food')::boolean and (x->>'state'='A' or g.activity<>'Colonia'))
  ) then raise exception 'VALIDACION: Revisá el plantel, asistencia, semáforo o comida.'; end if;
  insert into mp_private.sessions(group_id,day,season) values(g.id,p_day,g.season) on conflict(group_id,day,season) do nothing;
  select * into s from mp_private.sessions where group_id=g.id and day=p_day and season=g.season for update;
  if s.revision<>p_revision then raise exception using errcode='PT409',message='CONFLICTO: Otra persona modificó esta clase. Actualizá y revisá.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.athlete_id),'[]'::jsonb) into before_rows from mp_private.attendance x where session_id=s.id;
  before_rows:=jsonb_build_object('rows',before_rows,'climate',s.climate,'points',s.points);
  insert into mp_private.attendance(session_id,group_id,athlete_id,state,semaphore,food)
    select s.id,g.id,(x->>'id')::uuid,x->>'state',x->>'semaphore',(x->>'food')::boolean from jsonb_array_elements(p_rows) x
    on conflict(session_id,athlete_id) do update set state=excluded.state,semaphore=excluded.semaphore,food=excluded.food;
  update mp_private.sessions set revision=revision+1,climate=p_climate,points=p_points where id=s.id returning * into s;
  select jsonb_agg(jsonb_build_object('id',x.athlete_id,'name',p.name,'state',x.state,'semaphore',x.semaphore,'food',x.food) order by p.name,p.id)
    into after_rows from mp_private.attendance x join mp_private.athletes p on p.id=x.athlete_id where x.session_id=s.id;
  result:=jsonb_build_object('ok',true,'request_id',p_request,'group_id',g.id,'season',g.season,'revision',s.revision,'sheets_status','pending');
  insert into mp_private.receipts values(p_request,a.subject,payload,result,now());
  insert into mp_private.audit values(p_request,s.id,a.subject,before_rows,jsonb_build_object('rows',after_rows,'climate',p_climate,'points',p_points),now());
  insert into mp_private.projection_outbox(request_id,payload) values(p_request,jsonb_build_object('request_id',p_request,'group_id',g.id,'activity',g.activity,'group',g.label,'day',p_day,'season',g.season,'revision',s.revision,'actor',a.subject,'author',a.name,'rows',after_rows,'climate',p_climate,'points',p_points));
  return result;
end $$;
commit;
