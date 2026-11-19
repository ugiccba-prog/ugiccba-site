-- Run only after the owner requests retirement; never run during preparation.
-- The private manifest and original copies are retained for reconciliation.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if not exists(select 1 from mc_private.demo_runs where id='ensayo-16s-20261119' and status='active')then raise exception 'Ensayo no activo.';end if;
 perform 1 from mc_private.activities where name in(select activity from mc_private.demo_run_records where run_id='ensayo-16s-20261119') order by name for update;
 if exists(select 1 from mc_private.demo_run_records d left join mc_private.records r on r.activity=d.activity and r.kind=d.kind and r.key=d.key where d.run_id='ensayo-16s-20261119' and r.data is distinct from d.data)then raise exception 'El ensayo tiene modificaciones: reconciliar antes de retirar.';end if;
 -- New dates, evaluations or other rows in a demo group also need review.
 if exists(select 1 from mc_private.records r cross join lateral jsonb_array_elements(coalesce(r.data->'rows','[]'::jsonb)) p where exists(select 1 from mc_private.demo_run_records d where d.run_id='ensayo-16s-20261119' and d.activity=r.activity and d.kind='padron' and d.key=jsonb_build_array(p->>'categoria',p->>'equipo')) and not exists(select 1 from mc_private.demo_run_records d where d.run_id='ensayo-16s-20261119' and d.activity=r.activity and d.kind=r.kind and d.key=r.key))then raise exception 'Hay registros nuevos de prueba: revisar antes de retirar.';end if;
 if exists(select 1 from mc_private.fichas f join mc_private.demo_run_records d on d.activity=f.activity and d.kind='padron' cross join lateral jsonb_array_elements(d.data->'rows') p where d.run_id='ensayo-16s-20261119' and f.id=p->>'id')then raise exception 'Hay fichas nuevas del ensayo: reconciliar antes de retirar.';end if;
end $guard$;
delete from mc_private.records r using mc_private.demo_run_records d where d.run_id='ensayo-16s-20261119' and r.activity=d.activity and r.kind=d.kind and r.key=d.key;
-- Keep authorization, epochs, receipts and revisions; advance the activity version.
update mc_private.activities set version=version+1 where name in(select activity from mc_private.demo_run_records where run_id='ensayo-16s-20261119');
insert into mc_private.outbox(activity,version,updated_at)select name,version,now() from mc_private.activities where name in(select activity from mc_private.demo_run_records where run_id='ensayo-16s-20261119')on conflict(activity)do update set version=excluded.version,updated_at=excluded.updated_at;
insert into mc_private.audit(activity,id,event)
 select a.name,'retire_demo_20261119_'||md5(a.name),jsonb_build_object('id','retire_demo_20261119_'||md5(a.name),'fecha',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'uid',d.owner_uid,'autor','Dirección UGI','rol','Dirección UGI','tipo','RETIRO_DEMO','deporte',a.name,'version',a.version,'runId',d.id)
 from mc_private.activities a cross join mc_private.demo_runs d where d.id='ensayo-16s-20261119' and a.name in(select activity from mc_private.demo_run_records where run_id=d.id);
update mc_private.demo_runs set status='retired' where id='ensayo-16s-20261119';
commit;
