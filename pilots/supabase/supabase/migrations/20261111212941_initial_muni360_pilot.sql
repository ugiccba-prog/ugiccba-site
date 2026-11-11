-- Isolated pilot only. Apply to a NEW Supabase project, never the Apps Script store.
begin;
create schema mp_private;
revoke all on schema mp_private from public, anon, authenticated;
create table mp_private.settings(singleton boolean primary key default true check(singleton), firebase_project text not null);
insert into mp_private.settings values(true,'muni360-ugi-ensayo');
create table mp_private.principals(
  subject text primary key, name text not null, role text not null check(role in ('Profe','Coordinación','Dirección UGI','Consulta','Reemplazante')),
  status text not null default 'pendiente' check(status in ('activo','pendiente','suspendido')),
  activities text[] not null default '{}', expires_at timestamptz,
  check(role<>'Reemplazante' or expires_at is not null)
);
create table mp_private.groups(
  id uuid primary key default gen_random_uuid(), activity text not null, label text not null,
  season integer not null default 1 check(season>0), roster_revision integer not null default 1 check(roster_revision>0)
);
create index mp_groups_activity on mp_private.groups(activity,id);
create table mp_private.athletes(
  id uuid primary key default gen_random_uuid(), group_id uuid not null references mp_private.groups(id),
  name text not null, unique(group_id,id)
);
create index mp_athletes_group on mp_private.athletes(group_id,name,id);
create table mp_private.sessions(
  id uuid primary key default gen_random_uuid(), group_id uuid not null references mp_private.groups(id),
  day date not null, season integer not null, revision integer not null default 0,
  climate text not null default 'N' check(climate in ('N','Vapor','Fuego','Agua')),
  points integer check(points between 0 and 999), unique(group_id,day,season), unique(id,group_id)
);
create table mp_private.attendance(
  session_id uuid not null, group_id uuid not null, athlete_id uuid not null,
  state text not null check(state in ('N','P','A','T')), semaphore text not null check(semaphore in ('N','V','A','R')),
  food boolean not null default false, primary key(session_id,athlete_id),
  foreign key(session_id,group_id) references mp_private.sessions(id,group_id),
  foreign key(group_id,athlete_id) references mp_private.athletes(group_id,id),
  check(state<>'A' or not food)
);
create index mp_attendance_roster_fk on mp_private.attendance(group_id,athlete_id);
create table mp_private.receipts(
  request_id uuid primary key, actor text not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now()
);
create table mp_private.audit(
  request_id uuid primary key references mp_private.receipts(request_id), session_id uuid not null references mp_private.sessions(id),
  actor text not null, before_data jsonb not null, after_data jsonb not null, created_at timestamptz not null default now()
);
create index mp_audit_session on mp_private.audit(session_id,created_at);
create table mp_private.projection_outbox(
  request_id uuid primary key references mp_private.receipts(request_id), payload jsonb not null,
  state text not null default 'pending' check(state in ('pending','verified')),
  created_at timestamptz not null default now(), verified_at timestamptz
);
create index mp_outbox_pending on mp_private.projection_outbox(created_at,request_id) where state='pending';
-- No direct table access. The API only exposes the explicitly granted RPCs below.
alter table mp_private.settings enable row level security;
alter table mp_private.principals enable row level security;
alter table mp_private.groups enable row level security;
alter table mp_private.athletes enable row level security;
alter table mp_private.sessions enable row level security;
alter table mp_private.attendance enable row level security;
alter table mp_private.receipts enable row level security;
alter table mp_private.audit enable row level security;
alter table mp_private.projection_outbox enable row level security;
revoke all on all tables in schema mp_private from public, anon, authenticated;

create function mp_private.actor() returns mp_private.principals
language plpgsql security definer set search_path='' as $$
declare j jsonb:=auth.jwt(); p text; a mp_private.principals;
begin
  select firebase_project into p from mp_private.settings where singleton;
  if j->>'iss' is distinct from 'https://securetoken.google.com/'||p
     or j->>'aud' is distinct from p or coalesce(j->>'sub','')=''
     or j->>'email_verified' is distinct from 'true'
     or j#>>'{firebase,sign_in_provider}' is distinct from 'google.com'
     or coalesce((j->>'exp')::numeric,0)<=extract(epoch from now()) then
    raise exception using errcode='42501',message='SESION: Ingresá con Google en el proyecto correcto.';
  end if;
  select * into a from mp_private.principals where subject=j->>'sub' for share;
  if not found or a.status<>'activo' or (a.expires_at is not null and a.expires_at<=now()) then
    raise exception using errcode='42501',message='PERMISOS: Acceso pendiente, suspendido o vencido.';
  end if;
  return a;
end $$;
revoke all on function mp_private.actor() from public,anon,authenticated;

create function mp_private.mp_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a mp_private.principals;
begin a:=mp_private.actor(); return jsonb_build_object('uid',a.subject,'name',a.name,'role',a.role,'activities',a.activities); end $$;

create function mp_private.mp_groups() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a mp_private.principals; result jsonb;
begin
  a:=mp_private.actor();
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'activity',g.activity,'label',g.label) order by g.activity,g.label),'[]'::jsonb)
    into result from mp_private.groups g where g.activity=any(a.activities);
  return result;
end $$;

create function mp_private.mp_read_group(p_group uuid,p_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a mp_private.principals; g mp_private.groups; s mp_private.sessions; rows jsonb;
begin
  a:=mp_private.actor();
  select * into g from mp_private.groups where id=p_group for share;
  if not found or not(g.activity=any(a.activities)) then raise exception using errcode='42501',message='PERMISOS: Actividad no habilitada.'; end if;
  if p_day is null then raise exception 'VALIDACION: Fecha requerida.'; end if;
  select * into s from mp_private.sessions where group_id=g.id and day=p_day and season=g.season for share;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'state',coalesce(x.state,'N'),'semaphore',coalesce(x.semaphore,'N'),'food',coalesce(x.food,false)) order by p.name,p.id),'[]'::jsonb)
    into rows from mp_private.athletes p left join mp_private.attendance x on x.athlete_id=p.id and x.session_id=s.id where p.group_id=g.id;
  return jsonb_build_object('group_id',g.id,'activity',g.activity,'label',g.label,'day',p_day,'season',g.season,'roster_revision',g.roster_revision,'revision',coalesce(s.revision,0),'climate',coalesce(s.climate,'N'),'points',s.points,'rows',rows);
end $$;

create function mp_private.mp_save_attendance(p_request uuid,p_group uuid,p_day date,p_season integer,p_roster_revision integer,p_revision integer,p_rows jsonb,p_climate text default 'N',p_points integer default null) returns jsonb
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
    if prior.actor<>a.subject or prior.payload<>payload then raise exception using errcode='40001',message='CONFLICTO: Identificador usado con otra carga.'; end if;
    return prior.result;
  end if;
  if p_season<>g.season or p_roster_revision<>g.roster_revision then raise exception using errcode='40001',message='CONFLICTO: Cambió el padrón o la temporada.'; end if;
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
  if s.revision<>p_revision then raise exception using errcode='40001',message='CONFLICTO: Otra persona modificó esta clase. Actualizá y revisá.'; end if;
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

-- Firebase tokens may have no Postgres 'role' custom claim. Only these RPCs are
-- granted to anon; each checks the VERIFIED JWT and the private access table.
-- An unsigned/anonymous request cannot pass mp_private.actor(). No table grants.
revoke all on function mp_private.mp_profile(),mp_private.mp_groups(),mp_private.mp_read_group(uuid,date),mp_private.mp_save_attendance(uuid,uuid,date,integer,integer,integer,jsonb,text,integer) from public;
grant execute on function mp_private.mp_profile(),mp_private.mp_groups(),mp_private.mp_read_group(uuid,date),mp_private.mp_save_attendance(uuid,uuid,date,integer,integer,integer,jsonb,text,integer) to anon,authenticated;

create function mp_private.mp_projection_jobs(p_limit integer default 10) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(j.payload order by j.created_at,j.request_id),'[]'::jsonb)
  from (select * from mp_private.projection_outbox where state='pending' order by created_at,request_id limit greatest(0,least(p_limit,10))) j;
$$;
create function mp_private.mp_projection_ack(p_requests uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin update mp_private.projection_outbox set state='verified',verified_at=now() where request_id=any(p_requests) and state='pending';get diagnostics n=row_count;return n;end $$;
revoke all on function mp_private.mp_projection_jobs(integer),mp_private.mp_projection_ack(uuid[]) from public,anon,authenticated;
grant execute on function mp_private.mp_projection_jobs(integer),mp_private.mp_projection_ack(uuid[]) to service_role;

-- Only invoker wrappers are exposed through the public Data API.
-- Schema usage permits calling approved helpers, never direct table access.
grant usage on schema mp_private to anon,authenticated,service_role;
create function public.mp_profile() returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_profile();$$;
revoke all on function public.mp_profile() from public,anon,authenticated;
grant execute on function public.mp_profile() to anon,authenticated;
create function public.mp_groups() returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_groups();$$;
revoke all on function public.mp_groups() from public,anon,authenticated;
grant execute on function public.mp_groups() to anon,authenticated;
create function public.mp_read_group(p_group uuid,p_day date) returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_read_group(p_group,p_day);$$;
revoke all on function public.mp_read_group(uuid,date) from public,anon,authenticated;
grant execute on function public.mp_read_group(uuid,date) to anon,authenticated;
create function public.mp_save_attendance(p_request uuid,p_group uuid,p_day date,p_season integer,p_roster_revision integer,p_revision integer,p_rows jsonb,p_climate text default 'N',p_points integer default null) returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_save_attendance(p_request,p_group,p_day,p_season,p_roster_revision,p_revision,p_rows,p_climate,p_points);$$;
revoke all on function public.mp_save_attendance(uuid,uuid,date,integer,integer,integer,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.mp_save_attendance(uuid,uuid,date,integer,integer,integer,jsonb,text,integer) to anon,authenticated;
create function public.mp_projection_jobs(p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$select mp_private.mp_projection_jobs(p_limit);$$;
revoke all on function public.mp_projection_jobs(integer) from public,anon,authenticated;
grant execute on function public.mp_projection_jobs(integer) to service_role;
create function public.mp_projection_ack(p_requests uuid[]) returns integer language sql security invoker set search_path='' as $$select mp_private.mp_projection_ack(p_requests);$$;
revoke all on function public.mp_projection_ack(uuid[]) from public,anon,authenticated;
grant execute on function public.mp_projection_ack(uuid[]) to service_role;
commit;
