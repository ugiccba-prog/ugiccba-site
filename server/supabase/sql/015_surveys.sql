begin;

create table if not exists mc_private.surveys(
 id text primary key default gen_random_uuid()::text,
 public_code text unique not null,
 activity text not null,
 categoria text not null default '',
 equipo text not null default '',
 title text not null,
 description text not null default '',
 questions jsonb not null default '[]'::jsonb,
 status text not null default 'active',
 created_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (status in ('draft','active','closed'))
);

create index if not exists idx_surveys_activity on mc_private.surveys(activity, created_at desc);

create table if not exists mc_private.survey_responses(
 id text primary key default gen_random_uuid()::text,
 survey_id text not null references mc_private.surveys(id) on delete cascade,
 answers jsonb not null default '{}'::jsonb,
 submitted_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey on mc_private.survey_responses(survey_id, submitted_at desc);

alter table mc_private.surveys enable row level security;
alter table mc_private.survey_responses enable row level security;
revoke all on mc_private.surveys, mc_private.survey_responses from public,anon,authenticated;

create or replace function public.mc_surveys(p_action text,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 c mc_private.settings%rowtype;
 u jsonb;
 uid text:=p->>'uid';
 v_now timestamptz:=coalesce((p->>'now')::timestamptz,now());
 v_areas jsonb;
 v_survey mc_private.surveys%rowtype;
 v_code text;
 v_status text;
begin
 if p_action='public_get' then
  v_code:=trim(coalesce(p->>'code',''));
  select * into v_survey from mc_private.surveys where public_code=v_code;
  if v_survey.id is null or v_survey.status='draft' then
   raise exception using errcode='PT409',message='Encuesta no disponible.';
  end if;
  if v_survey.status='closed' then
   return jsonb_build_object('ok',true,'closed',true,'survey',jsonb_build_object(
    'title',v_survey.title,'activity',v_survey.activity,'categoria',v_survey.categoria,'equipo',v_survey.equipo,'status',v_survey.status
   ));
  end if;
  return jsonb_build_object('ok',true,'closed',false,'survey',jsonb_build_object(
   'title',v_survey.title,'description',v_survey.description,'activity',v_survey.activity,
   'categoria',v_survey.categoria,'equipo',v_survey.equipo,'questions',v_survey.questions,'status',v_survey.status
  ));
 end if;

 if p_action='public_submit' then
  v_code:=trim(coalesce(p->>'code',''));
  select * into v_survey from mc_private.surveys where public_code=v_code for share;
  if v_survey.id is null or v_survey.status<>'active' then
   raise exception using errcode='PT409',message='Esta encuesta ya no recibe respuestas.';
  end if;
  insert into mc_private.survey_responses(survey_id,answers,submitted_at)
  values(v_survey.id,coalesce(p->'answers','{}'::jsonb),v_now);
  return jsonb_build_object('ok',true);
 end if;

 select * into strict c from mc_private.settings where id;
 select record into u from mc_private.users where mc_private.users.uid=uid for share;
 if u is null or u->>'status'<>'activo' or (u->>'expiresAt' is not null and (u->>'expiresAt')::timestamptz<=v_now) then
  raise exception using errcode='42501',message='Tu acceso está pendiente, suspendido o vencido.';
 end if;
 if uid<>c.owner_uid and u->>'rol' not in ('Coordinación','Dirección UGI') then
  raise exception using errcode='42501',message='Este módulo requiere autorización de Coordinación o Dirección.';
 end if;
 v_areas:=case when uid=c.owner_uid then c.areas else coalesce(u->'areas','[]'::jsonb) end;

 if p_action='create' then
  if not (v_areas ? (p->>'activity')) then
   raise exception using errcode='42501',message='No tenés acceso a esa actividad.';
  end if;
  v_code:=substr(replace(gen_random_uuid()::text,'-',''),1,12);
  v_status:=coalesce(nullif(p->>'status',''),'active');
  if v_status not in ('draft','active') then v_status:='active'; end if;
  insert into mc_private.surveys(public_code,activity,categoria,equipo,title,description,questions,status,created_by,created_at,updated_at)
  values(
   v_code,
   p->>'activity',
   trim(coalesce(p->>'categoria','')),
   trim(coalesce(p->>'equipo','')),
   left(trim(p->>'title'),120),
   left(trim(coalesce(p->>'description','')),400),
   coalesce(p->'questions','[]'::jsonb),
   v_status,
   uid,
   v_now,
   v_now
  ) returning * into v_survey;
  return jsonb_build_object('ok',true,'survey',to_jsonb(v_survey));
 end if;

 if p_action='set_status' then
  select * into v_survey from mc_private.surveys where id=p->>'surveyId' for update;
  if v_survey.id is null then raise exception using errcode='PT409',message='Encuesta inexistente.'; end if;
  if not (v_areas ? v_survey.activity) then raise exception using errcode='42501',message='No tenés acceso a esa actividad.'; end if;
  v_status:=p->>'status';
  if v_status not in ('draft','active','closed') then raise exception using errcode='PT409',message='Estado inválido.'; end if;
  update mc_private.surveys set status=v_status,updated_at=v_now where id=v_survey.id returning * into v_survey;
  return jsonb_build_object('ok',true,'survey',to_jsonb(v_survey));
 end if;

 if p_action='list' then
  return jsonb_build_object(
   'ok',true,
   'surveys',coalesce((
    select jsonb_agg(
     to_jsonb(s) || jsonb_build_object(
      'responseCount',(select count(*) from mc_private.survey_responses sr where sr.survey_id=s.id),
      'responses',coalesce((
       select jsonb_agg(sr.answers order by sr.submitted_at desc)
       from mc_private.survey_responses sr
       where sr.survey_id=s.id
      ),'[]'::jsonb)
     )
     order by s.created_at desc
    )
    from mc_private.surveys s
    where v_areas ? s.activity
      and (nullif(p->>'activity','') is null or s.activity=p->>'activity')
   ),'[]'::jsonb)
  );
 end if;

 raise exception 'Acción de encuestas desconocida.';
end$$;

revoke all on function public.mc_surveys(text,jsonb) from public,anon,authenticated;
grant execute on function public.mc_surveys(text,jsonb) to service_role;

commit;
