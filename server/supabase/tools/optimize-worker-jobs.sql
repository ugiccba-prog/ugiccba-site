-- Reviewed operational patch; apply only after approval for the hosted server.
-- Same signature, authentication, redaction and locking. No grants or role changes.
begin;
create or replace function mc_private.worker_jobs(p_secret text,p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare job record;s jsonb;out jsonb:='[]'::jsonb;hs jsonb;sv jsonb;
begin
 perform mc_private.worker_auth(p_secret);
 -- One activity per call bounds serialization cost and Sheets writes. Leaving
 -- jobs unacknowledged preserves retries and newer outbox versions.
 for job in select o.activity,o.version,a.epoch,t.sheet_id
  from mc_private.outbox o join mc_private.activities a on a.name=o.activity
  left join mc_private.sheet_targets t on t.activity=o.activity
  order by o.updated_at,o.activity limit greatest(0,least(p_limit,1))
  for share of o,a loop
  -- Aggregate once. Repeated jsonb_set/array concatenation copied the growing
  -- season for every document, causing the hosted statement timeout.
  select jsonb_build_object(
   'padron',coalesce(jsonb_agg(x.row order by r.key,x.n) filter(where r.kind='padron'),'[]'::jsonb),
   'asistencia',coalesce(jsonb_agg(x.row order by r.key,x.n) filter(where r.kind='asistencia'),'[]'::jsonb),
   'evaluaciones',coalesce(jsonb_agg(x.row order by r.key,x.n) filter(where r.kind='evaluaciones'),'[]'::jsonb),
   'gestos',coalesce((select data->'gestos' from mc_private.records where activity=job.activity and kind='config' order by key desc limit 1),'[]'::jsonb),
   'fichas',coalesce((select jsonb_object_agg(id,value) from mc_private.fichas where activity=job.activity),'{}'::jsonb))
  into s from mc_private.records r
  cross join lateral jsonb_array_elements(coalesce(r.data->'rows','[]'::jsonb)) with ordinality x(row,n)
  where r.activity=job.activity and r.kind in('padron','asistencia','evaluaciones')
   and r.data->>'kind'=r.kind;
  hs:=coalesce((select jsonb_agg(jsonb_set(value,'{state}',mc_private.sanitize(value->'state'))) from mc_private.archives where activity=job.activity),'[]'::jsonb);
  sv:='[]'::jsonb;
  if to_regclass('mc_private.surveys') is not null then
   execute $q$
    select coalesce((
     select jsonb_agg(
      jsonb_build_object(
       'id',s.id,
       'title',s.title,
       'categoria',s.categoria,
       'equipo',s.equipo,
       'status',s.status,
       'created_at',s.created_at,
       'questions',s.questions,
       'responseCount',(select count(*) from mc_private.survey_responses sr where sr.survey_id=s.id),
       'responses',coalesce((
        select jsonb_agg(sr.answers order by sr.submitted_at desc)
        from (
         select answers,submitted_at
         from mc_private.survey_responses
         where survey_id=s.id
         order by submitted_at desc
         limit 100
        ) sr
       ),'[]'::jsonb)
      )
      order by s.created_at desc
     )
     from mc_private.surveys s
     where s.activity=$1 and s.status in ('active','closed')
    ),'[]'::jsonb)
   $q$ into sv using job.activity;
  end if;
  out:=out||jsonb_build_array(jsonb_build_object(
   'activity',job.activity,'version',job.version,'sheet_id',job.sheet_id,'epoch',job.epoch,
   'state',mc_private.sanitize(s),'archives',hs,'surveys',coalesce(sv,'[]'::jsonb),
   'audit',coalesce((select jsonb_agg(event-'antes'-'despues'-'uid'-'rol') from mc_private.audit where activity=job.activity and event->>'tipo' in('ASISTENCIA','EVALUACION','RECONOCIMIENTO')),'[]'::jsonb)));
 end loop;
 return out;
end $$;
commit;
