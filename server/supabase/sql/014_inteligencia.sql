begin;

create table if not exists mc_private.inteligencia_cases(
 id text primary key default gen_random_uuid()::text,
 case_key text not null,
 activity text not null,
 categoria text not null default '',
 equipo text not null default '',
 rule_code text not null,
 severity text not null default 'media',
 title text not null,
 summary text not null,
 metrics jsonb not null default '{}'::jsonb,
 status text not null default 'abierta',
 opened_at timestamptz not null default now(),
 due_at timestamptz not null default (now() + interval '48 hours'),
 escalated_at timestamptz,
 resolved_at timestamptz,
 updated_at timestamptz not null default now(),
 updated_by text,
 notes jsonb not null default '[]'::jsonb,
 check (severity in ('alta','media')),
 check (status in ('abierta','en_revision','intervenida','escalada','resuelta'))
);

create unique index if not exists idx_inteligencia_open_case_key
 on mc_private.inteligencia_cases(case_key)
 where status in ('abierta','en_revision','intervenida','escalada');

create index if not exists idx_inteligencia_activity_status
 on mc_private.inteligencia_cases(activity, status, updated_at desc);

alter table mc_private.inteligencia_cases enable row level security;
revoke all on mc_private.inteligencia_cases from public,anon,authenticated;

create or replace function mc_private.inteligencia_escalate(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update mc_private.inteligencia_cases
 set status='escalada',
     escalated_at=coalesce(escalated_at,p_now),
     updated_at=p_now
 where status in ('abierta','en_revision') and due_at<=p_now;
 get diagnostics n=row_count;
 return n;
end$$;

create or replace function mc_private.inteligencia_scan(p_uid text,p_activity text,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 c mc_private.settings%rowtype;
 u jsonb;
 a mc_private.activities%rowtype;
 v_today date;
 v_upserted integer:=0;
begin
 select * into strict c from mc_private.settings where id;
 select record into u from mc_private.users where uid=p_uid for share;
 if u is null or u->>'status'<>'activo' or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=p_now) then
  raise exception using errcode='42501',message='Tu acceso está pendiente, suspendido o vencido.';
 end if;
 if p_uid<>c.owner_uid and u->>'rol' not in ('Coordinación','Dirección UGI') then
  raise exception using errcode='42501',message='Este módulo requiere autorización de Coordinación o Dirección.';
 end if;
 select * into a from mc_private.activities where name=p_activity for share;
 if a.name is null or not a.enabled then
  raise exception using errcode='PT409',message='Actividad no habilitada.';
 end if;
 if p_uid<>c.owner_uid and u->>'rol'<>'Dirección UGI' and not (coalesce(u->'areas','[]'::jsonb)?p_activity) then
  raise exception using errcode='42501',message='No tenés acceso a esa actividad.';
 end if;

 perform mc_private.inteligencia_escalate(p_now);
 v_today:=(p_now at time zone 'America/Argentina/Buenos_Aires')::date;

 with att as (
  select
   coalesce(nullif(trim(r.elem->>'categoria'),''),'Sin categoría') as categoria,
   coalesce(nullif(trim(r.elem->>'equipo'),''),'General') as equipo,
   coalesce(nullif(trim(r.elem->>'jugadorId'),''),coalesce(r.elem->>'jugador','')) as jugador_id,
   coalesce(r.elem->>'jugador','') as jugador,
   (r.elem->>'fecha')::date as fecha,
   coalesce(r.elem->>'estado','') as estado,
   left(coalesce(r.elem->>'estado',''),1) as code
  from mc_private.records s
  cross join lateral jsonb_array_elements(coalesce(s.data->'rows','[]'::jsonb)) as r(elem)
  where s.activity=p_activity and s.kind='asistencia'
    and (r.elem->>'fecha') ~ '^\d{4}-\d{2}-\d{2}$'
    and (r.elem->>'fecha')::date <= v_today
    and (r.elem->>'fecha')::date >= v_today - 45
 ),
 drop_alerts as (
  select
   categoria,equipo,
   count(*) filter (where code in ('P','T','A') and fecha >= v_today - 13) as recent_reg,
   count(*) filter (where code in ('P','T') and fecha >= v_today - 13) as recent_pres,
   count(*) filter (where code in ('P','T','A') and fecha < v_today - 13 and fecha >= v_today - 41) as base_reg,
   count(*) filter (where code in ('P','T') and fecha < v_today - 13 and fecha >= v_today - 41) as base_pres
  from att
  group by categoria,equipo
 ),
 drop_cases as (
  select
   p_activity||'|CAIDA_ASISTENCIA|'||categoria||'|'||equipo as case_key,
   p_activity as activity,categoria,equipo,'CAIDA_ASISTENCIA' as rule_code,
   case when (recent_pres*100.0/recent_reg) < 50 or (base_reg >= 4 and (base_pres*100.0/base_reg) - (recent_pres*100.0/recent_reg) >= 30) then 'alta' else 'media' end as severity,
   'Caída de asistencia en '||categoria||' · '||equipo as title,
   'Asistencia reciente '||round(recent_pres*100.0/recent_reg,1)||'% ('||recent_reg||' reg.)'||
   case when base_reg>=4 then ' frente a '||round(base_pres*100.0/base_reg,1)||'% en las 4 semanas previas.' else '.' end as summary,
   jsonb_build_object(
    'recentPct',round(recent_pres*100.0/recent_reg,1),
    'recentReg',recent_reg,
    'baselinePct',case when base_reg>=4 then round(base_pres*100.0/base_reg,1) else null end,
    'baselineReg',base_reg
   ) as metrics
  from drop_alerts
  where recent_reg >= 2
    and ((base_reg >= 4 and (recent_pres*100.0/recent_reg) <= (base_pres*100.0/base_reg) - 20)
         or (recent_pres*100.0/recent_reg) < 60)
 ),
 ordered_att as (
  select
   categoria,equipo,jugador_id,jugador,code,
   row_number() over (partition by categoria,equipo,jugador_id order by fecha desc) as rn
  from att
  where code in ('P','T','A') and jugador_id <> ''
 ),
 consec_players as (
  select
   categoria,equipo,jugador_id,max(jugador) as jugador,
   coalesce(min(case when code <> 'A' then rn end) - 1, count(*)) as streak
  from ordered_att
  group by categoria,equipo,jugador_id
  having coalesce(min(case when code <> 'A' then rn end) - 1, count(*)) >= 3
 ),
 consec_cases as (
  select
   p_activity||'|AUSENCIAS_CONSECUTIVAS|'||categoria||'|'||equipo as case_key,
   p_activity as activity,categoria,equipo,'AUSENCIAS_CONSECUTIVAS' as rule_code,
   case when count(*) >= 3 or max(streak) >= 5 then 'alta' else 'media' end as severity,
   count(*)||' integrante(s) con 3+ ausencias seguidas en '||categoria||' · '||equipo as title,
   'Se detectaron '||count(*)||' integrante(s) con al menos 3 ausencias consecutivas en los últimos 45 días.' as summary,
   jsonb_build_object(
    'count',count(*),
    'maxStreak',max(streak),
    'jugadores',jsonb_agg(jsonb_build_object('nombre',jugador,'racha',streak) order by streak desc, jugador)
   ) as metrics
  from consec_players
  group by categoria,equipo
 ),
 sem_agg as (
  select
   categoria,equipo,
   count(*) filter (where estado ~ 'Sem:[VAR]') as observados,
   count(*) filter (where estado ~ 'Sem:A') as amarillo,
   count(*) filter (where estado ~ 'Sem:R') as rojo
  from att
  where fecha >= v_today - 20
  group by categoria,equipo
 ),
 sem_cases as (
  select
   p_activity||'|SEMAFORO_ALERTA|'||categoria||'|'||equipo as case_key,
   p_activity as activity,categoria,equipo,'SEMAFORO_ALERTA' as rule_code,
   case when rojo >= 2 or (rojo*100.0/observados) >= 35 then 'alta' else 'media' end as severity,
   'Alerta de semáforo en '||categoria||' · '||equipo as title,
   (amarillo+rojo)||' observaciones amarillas/rojas sobre '||observados||' en los últimos 21 días (🟡'||amarillo||' 🔴'||rojo||').' as summary,
   jsonb_build_object('observados',observados,'amarillo',amarillo,'rojo',rojo) as metrics
  from sem_agg
  where observados >= 3 and ((amarillo+rojo)*100.0/observados >= 50 or rojo >= 2)
 ),
 all_detected as (
  select * from drop_cases
  union all
  select * from consec_cases
  union all
  select * from sem_cases
 ),
 upserted as (
  insert into mc_private.inteligencia_cases(
   case_key,activity,categoria,equipo,rule_code,severity,title,summary,metrics,
   status,opened_at,due_at,updated_at
  )
  select
   d.case_key,d.activity,d.categoria,d.equipo,d.rule_code,d.severity,d.title,d.summary,d.metrics,
   'abierta',p_now,p_now + interval '48 hours',p_now
  from all_detected d
  on conflict (case_key) where status in ('abierta','en_revision','intervenida','escalada')
  do update set
   severity=excluded.severity,
   title=excluded.title,
   summary=excluded.summary,
   metrics=excluded.metrics,
   updated_at=p_now
  returning id
 )
 select count(*) into v_upserted from upserted;

 return jsonb_build_object(
  'ok',true,
  'activity',p_activity,
  'scanned',v_upserted,
  'cases',coalesce((
   select jsonb_agg(to_jsonb(ic) order by
    case ic.status when 'escalada' then 0 when 'abierta' then 1 when 'en_revision' then 2 when 'intervenida' then 3 else 4 end,
    ic.updated_at desc)
   from mc_private.inteligencia_cases ic
   where ic.activity=p_activity
  ),'[]'::jsonb)
 );
end$$;

create or replace function public.mc_inteligencia(p_action text,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 c mc_private.settings%rowtype;
 u jsonb;
 uid text:=p->>'uid';
 v_now timestamptz:=coalesce((p->>'now')::timestamptz,now());
 v_areas jsonb;
 v_case mc_private.inteligencia_cases%rowtype;
 v_next text;
 v_note text;
 v_entry jsonb;
begin
 select * into strict c from mc_private.settings where id;
 select record into u from mc_private.users where mc_private.users.uid=uid for share;
 if u is null or u->>'status'<>'activo' or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=v_now) then
  raise exception using errcode='42501',message='Tu acceso está pendiente, suspendido o vencido.';
 end if;
 if uid<>c.owner_uid and u->>'rol' not in ('Coordinación','Dirección UGI') then
  raise exception using errcode='42501',message='Este módulo requiere autorización de Coordinación o Dirección.';
 end if;

 v_areas:=case when uid=c.owner_uid then c.areas else coalesce(u->'areas','[]'::jsonb) end;

 if p_action='scan' then
  return mc_private.inteligencia_scan(uid,p->>'activity',v_now);
 end if;

 if p_action='list' then
  perform mc_private.inteligencia_escalate(v_now);
  return jsonb_build_object(
   'ok',true,
   'generatedAt',v_now,
   'cases',coalesce((
    select jsonb_agg(to_jsonb(ic) order by
     case ic.status when 'escalada' then 0 when 'abierta' then 1 when 'en_revision' then 2 when 'intervenida' then 3 else 4 end,
     ic.updated_at desc)
    from mc_private.inteligencia_cases ic
    where v_areas ? ic.activity
      and (coalesce(jsonb_typeof(p->'activities'),'null')='null' or p->'activities' ? ic.activity)
      and (nullif(p->>'status','') is null
           or (p->>'status'='activas' and ic.status in ('abierta','en_revision','intervenida','escalada'))
           or ic.status = p->>'status')
   ),'[]'::jsonb),
   'counts',(
    select jsonb_build_object(
     'abierta',count(*) filter (where status='abierta'),
     'en_revision',count(*) filter (where status='en_revision'),
     'intervenida',count(*) filter (where status='intervenida'),
     'escalada',count(*) filter (where status='escalada'),
     'resuelta',count(*) filter (where status='resuelta')
    )
    from mc_private.inteligencia_cases ic
    where v_areas ? ic.activity
   )
  );
 end if;

 if p_action='update' then
  select * into v_case from mc_private.inteligencia_cases where id=p->>'caseId' for update;
  if v_case.id is null then
   raise exception using errcode='PT409',message='Caso inexistente.';
  end if;
  if not (v_areas ? v_case.activity) then
   raise exception using errcode='42501',message='No tenés acceso a esa actividad.';
  end if;
  v_next:=p->>'status';
  if v_next not in ('abierta','en_revision','intervenida','resuelta') then
   raise exception using errcode='PT409',message='Estado de caso inválido.';
  end if;
  v_note:=left(trim(coalesce(p->>'note','')),500);
  v_entry:=jsonb_build_object(
   'at',v_now,
   'uid',uid,
   'autor',coalesce(u->>'nombre',''),
   'rol',coalesce(u->>'rol',''),
   'action',v_next,
   'note',v_note
  );
  update mc_private.inteligencia_cases
  set status=v_next,
      resolved_at=case when v_next='resuelta' then v_now else null end,
      updated_at=v_now,
      updated_by=uid,
      notes=coalesce(notes,'[]'::jsonb)||jsonb_build_array(v_entry)
  where id=v_case.id
  returning * into v_case;
  return jsonb_build_object('ok',true,'case',to_jsonb(v_case));
 end if;

 raise exception 'Acción de Inteligencia desconocida.';
end$$;

revoke all on function mc_private.inteligencia_escalate(timestamptz) from public,anon,authenticated;
revoke all on function mc_private.inteligencia_scan(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.mc_inteligencia(text,jsonb) from public,anon,authenticated;
grant execute on function public.mc_inteligencia(text,jsonb) to service_role;

commit;
