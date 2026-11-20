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

create table if not exists mc_private.inteligencia_config(
 id boolean primary key default true check(id),
 api_key text not null default '',
 model text not null default 'gemini-2.5-flash',
 updated_at timestamptz not null default now()
);

alter table mc_private.inteligencia_config enable row level security;
revoke all on mc_private.inteligencia_config from public,anon,authenticated;

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
 v_survey_upserted integer:=0;
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

 if to_regclass('mc_private.surveys') is not null then
  execute $q$
   with scale_vals as (
    select
     s.id,
     s.activity,
     trim(coalesce(s.categoria,'')) as categoria,
     trim(coalesce(s.equipo,'')) as equipo,
     s.title,
     (sr.answers->>(q.elem->>'id'))::numeric as val,
     sr.id as resp_id
    from mc_private.surveys s
    join mc_private.survey_responses sr on sr.survey_id=s.id
    cross join lateral jsonb_array_elements(coalesce(s.questions,'[]'::jsonb)) q(elem)
    where s.activity=$1
      and s.status in ('active','closed')
      and q.elem->>'type'='scale'
      and coalesce(sr.answers->>(q.elem->>'id'),'') ~ '^[1-5](?:\.0+)?$'
   ),
   survey_agg as (
    select
     id as survey_id,
     activity,
     max(categoria) as categoria,
     max(equipo) as equipo,
     max(title) as title,
     count(distinct resp_id) as resp_count,
     round(avg(val),2) as avg_scale,
     count(*) filter (where val <= 2) as low_count
    from scale_vals
    group by id, activity
    having avg(val) < 3.2 or count(*) filter (where val <= 2) >= 2
   ),
   survey_upserted as (
    insert into mc_private.inteligencia_cases(
     case_key,activity,categoria,equipo,rule_code,severity,title,summary,metrics,
     status,opened_at,due_at,updated_at
    )
    select
     sa.activity||'|CUESTIONARIO_ALERTA|'||sa.survey_id,
     sa.activity,
     sa.categoria,
     sa.equipo,
     'CUESTIONARIO_ALERTA',
     case when sa.avg_scale < 2.5 or sa.low_count >= 3 then 'alta' else 'media' end,
     'Señal en cuestionario: '||sa.title,
     'Promedio de escala '||sa.avg_scale||' / 5 en '||sa.resp_count||' respuesta(s) ('||sa.low_count||' valoración(es) baja(s) ≤ 2).',
     jsonb_build_object('surveyId',sa.survey_id,'responseCount',sa.resp_count,'avgScale',sa.avg_scale,'lowCount',sa.low_count),
     'abierta',$2,$2 + interval '48 hours',$2
    from survey_agg sa
    on conflict (case_key) where status in ('abierta','en_revision','intervenida','escalada')
    do update set
     severity=excluded.severity,
     title=excluded.title,
     summary=excluded.summary,
     metrics=excluded.metrics,
     updated_at=$2
    returning id
   )
   select count(*) from survey_upserted
  $q$ into v_survey_upserted using p_activity, p_now;
  v_upserted:=v_upserted + coalesce(v_survey_upserted,0);
 end if;

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
 v_cfg mc_private.inteligencia_config%rowtype;
 v_next text;
 v_note text;
 v_entry jsonb;
 v_case_id text;
 v_cases jsonb;
 v_surveys jsonb:='[]'::jsonb;
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
   'aiConfigured',exists(select 1 from mc_private.inteligencia_config where id and length(trim(api_key))>0),
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
   ),
   'ruleCounts',(
    select jsonb_build_object(
     'CAIDA_ASISTENCIA',count(*) filter (where rule_code='CAIDA_ASISTENCIA'),
     'AUSENCIAS_CONSECUTIVAS',count(*) filter (where rule_code='AUSENCIAS_CONSECUTIVAS'),
     'SEMAFORO_ALERTA',count(*) filter (where rule_code='SEMAFORO_ALERTA'),
     'CUESTIONARIO_ALERTA',count(*) filter (where rule_code='CUESTIONARIO_ALERTA')
    )
    from mc_private.inteligencia_cases ic
    where v_areas ? ic.activity
      and (coalesce(jsonb_typeof(p->'activities'),'null')='null' or p->'activities' ? ic.activity)
      and status in ('abierta','en_revision','intervenida','escalada')
   )
  );
 end if;

 if p_action='ai_context' then
  perform mc_private.inteligencia_escalate(v_now);
  select * into v_cfg from mc_private.inteligencia_config where id;
  v_case_id:=nullif(trim(coalesce(p->>'caseId','')),'');
  if v_case_id is not null then
   select * into v_case from mc_private.inteligencia_cases where id=v_case_id;
   if v_case.id is null then
    raise exception using errcode='PT409',message='Caso inexistente.';
   end if;
   if not (v_areas ? v_case.activity) then
    raise exception using errcode='42501',message='No tenés acceso a esa actividad.';
   end if;
   v_cases:=jsonb_build_array(to_jsonb(v_case));
  else
   v_cases:=coalesce((
    select jsonb_agg(to_jsonb(ic) order by
     case ic.status when 'escalada' then 0 when 'abierta' then 1 when 'en_revision' then 2 when 'intervenida' then 3 else 4 end,
     ic.updated_at desc)
    from mc_private.inteligencia_cases ic
    where v_areas ? ic.activity
      and (coalesce(jsonb_typeof(p->'activities'),'null')='null' or p->'activities' ? ic.activity)
      and ic.status in ('abierta','en_revision','intervenida','escalada')
   ),'[]'::jsonb);
  end if;
  if to_regclass('mc_private.surveys') is not null then
   execute $q$
    select coalesce((
     select jsonb_agg(
      to_jsonb(s) || jsonb_build_object(
       'responseCount',(select count(*) from mc_private.survey_responses sr where sr.survey_id=s.id),
       'responses',coalesce((
        select jsonb_agg(sr.answers order by sr.submitted_at desc)
        from (
         select answers, submitted_at
         from mc_private.survey_responses
         where survey_id=s.id
         order by submitted_at desc
         limit 50
        ) sr
       ),'[]'::jsonb)
      )
      order by s.created_at desc
     )
     from mc_private.surveys s
     where $1 ? s.activity
       and s.status in ('active','closed')
       and ($2 is null or s.activity=$2)
       and (coalesce(jsonb_typeof($3),'null')='null' or $3 ? s.activity)
    ),'[]'::jsonb)
   $q$ into v_surveys using v_areas, case when v_case_id is not null then v_case.activity else null end, p->'activities';
  end if;
  return jsonb_build_object(
   'ok',true,
   'apiKey',coalesce(v_cfg.api_key,''),
   'model',coalesce(nullif(v_cfg.model,''),'gemini-2.5-flash'),
   'cases',v_cases,
   'surveys',coalesce(v_surveys,'[]'::jsonb)
  );
 end if;

 if p_action='set_ai_key' then
  if uid<>c.owner_uid then
   raise exception using errcode='42501',message='Sólo el propietario configura la clave de IA.';
  end if;
  insert into mc_private.inteligencia_config(id,api_key,model,updated_at)
  values(
   true,
   trim(coalesce(p->>'apiKey','')),
   coalesce(nullif(trim(p->>'model'),''),'gemini-2.5-flash'),
   v_now
  )
  on conflict (id) do update set
   api_key=excluded.api_key,
   model=excluded.model,
   updated_at=v_now;
  return jsonb_build_object('ok',true,'aiConfigured',length(trim(coalesce(p->>'apiKey','')))>0);
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
