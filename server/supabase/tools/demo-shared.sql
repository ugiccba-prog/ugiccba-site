-- Administrative, transactional data load. No app deployment or permission changes.
-- Group input is supplied by build-muni360-demo-sql.mjs.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
create table if not exists mc_private.demo_runs(
 id text primary key, created_at timestamptz not null default now(),
 owner_uid text not null, baseline jsonb not null, status text not null default 'active'
);
create table if not exists mc_private.demo_run_records(
 run_id text not null references mc_private.demo_runs(id),activity text not null,
 kind text not null,key jsonb not null,data jsonb not null,
 primary key(run_id,activity,kind,key)
);
alter table mc_private.demo_runs enable row level security;
alter table mc_private.demo_run_records enable row level security;
revoke all on mc_private.demo_runs,mc_private.demo_run_records from public,anon,authenticated;
create temporary table demo_groups on commit drop as
 select * from jsonb_to_recordset($groups$__DEMO_GROUPS__$groups$::jsonb)
 as x(activity text,categoria text,equipo text,scenario text);
do $guard$
begin
 if exists(select 1 from mc_private.demo_runs where id='ensayo-16s-20261119') then raise exception 'El ensayo ya fue cargado; no repetir.';end if;
 if (select mode from mc_private.settings where id) is distinct from 'ready' then raise exception 'Base no disponible para carga.';end if;
 if (select count(*) from demo_groups)<>345 or (select count(distinct activity) from demo_groups)<>22 then raise exception 'Catálogo incompleto.';end if;
 if exists(select 1 from demo_groups g left join mc_private.activities a on a.name=g.activity where a.name is null or not a.enabled) then raise exception 'Actividad no habilitada.';end if;
 perform 1 from mc_private.activities a where a.name in(select activity from demo_groups) order by a.name for update;
 if exists(select 1 from mc_private.records r cross join lateral jsonb_array_elements(coalesce(r.data->'rows','[]'::jsonb)) p join demo_groups g on g.activity=r.activity and lower(trim(p->>'categoria'))=lower(trim(g.categoria)) and lower(trim(p->>'equipo'))=lower(trim(g.equipo))) then raise exception 'Grupo ocupado: no se modifica ningún dato.';end if;
 if not exists(select 1 from mc_private.users u join mc_private.settings s on u.uid=s.owner_uid where s.id and u.record->>'status'='activo') then raise exception 'Propietario no activo.';end if;
end $guard$;
insert into mc_private.demo_runs(id,owner_uid,baseline)
select 'ensayo-16s-20261119',s.owner_uid,jsonb_build_object(
 'activities',(select jsonb_agg(to_jsonb(a) order by name) from mc_private.activities a where name in(select activity from demo_groups)),
 'records',(select coalesce(jsonb_agg(to_jsonb(r) order by activity,kind,key),'[]'::jsonb) from mc_private.records r where activity in(select activity from demo_groups)),
 'versions',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from mc_private.versions v where activity in(select activity from demo_groups)))
from mc_private.settings s where id;
create temporary table demo_people on commit drop as
 select g.*,i,'DEMO '||lpad(i::text,2,'0') as jugador,
 'demo-'||md5(concat_ws('|','ensayo-16s-20261119',activity,categoria,equipo,i)) as jugador_id
 from demo_groups g cross join generate_series(1,8)i;
create temporary table demo_rows(kind text,activity text,categoria text,equipo text,fecha text,jugador text,row_data jsonb) on commit drop;
insert into demo_rows
 select 'padron',activity,categoria,equipo,'','',jsonb_build_object('id',jugador_id,'jugador',jugador,'dni','','categoria',categoria,'equipo',equipo) from demo_people;
insert into demo_rows
 select 'asistencia',p.activity,p.categoria,p.equipo,f.fecha,'',
 jsonb_build_object('fecha',f.fecha,'categoria',p.categoria,'equipo',p.equipo,'jugador',p.jugador,'jugadorId',p.jugador_id,
 'estado',case when (w<4 and i=8) or (w>=4 and w<12 and i>=5) or (w>=12 and case when scenario='A' then i=8 else i>=5 end) then 'A | Sem:R' else 'P | Sem:V' end,'clima','N','puntosCiudad','')
 from demo_people p cross join generate_series(0,15)w cross join (values(0),(3))o(n)
 cross join lateral(select to_char(date '2026-07-27'+(w*7+o.n),'YYYY-MM-DD') fecha) f;
insert into demo_rows
 select 'evaluaciones',p.activity,p.categoria,p.equipo,to_char(date '2026-07-27'+w*7,'YYYY-MM-DD'),p.jugador,
 jsonb_build_object('fecha',to_char(date '2026-07-27'+w*7,'YYYY-MM-DD'),'categoria',p.categoria,'equipo',p.equipo,'jugador',p.jugador,'jugadorId',p.jugador_id,'notas',jsonb_build_object('Tecnica',6+w/10.0,'Convivencia',7))
 from demo_people p cross join generate_series(3,15,4)w;
insert into mc_private.demo_run_records
 select 'ensayo-16s-20261119',activity,kind,
 case kind when 'padron' then jsonb_build_array(categoria,equipo) when 'asistencia' then jsonb_build_array(fecha,categoria,equipo) else jsonb_build_array(fecha,categoria,equipo,jugador) end,
 jsonb_build_object('kind',kind,'rows',jsonb_agg(row_data order by row_data->>'jugador'))
 from demo_rows group by activity,kind,categoria,equipo,fecha,jugador;
-- Roster grouping must aggregate people; the empty jugador column above ensures it.
insert into mc_private.records(activity,kind,key,data)
 select activity,kind,key,data from mc_private.demo_run_records where run_id='ensayo-16s-20261119';
-- Resource strings match JSON.stringify used by the existing sync client.
insert into mc_private.versions(activity,key,revision)
 select activity,'["PADRON",'||to_jsonb(lower(trim(categoria)))::text||','||to_jsonb(lower(trim(equipo)))::text||',"",""]',1 from demo_groups
 on conflict(activity,key)do update set revision=mc_private.versions.revision+1;
update mc_private.activities set version=version+1 where name in(select activity from demo_groups);
insert into mc_private.audit(activity,id,event)
 select a.name,'demo_20261119_'||md5(a.name),jsonb_build_object('id','demo_20261119_'||md5(a.name),'fecha',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'uid',r.owner_uid,'autor','Dirección UGI · carga ficticia','rol','Dirección UGI','tipo','IMPORTACION_DEMO','deporte',a.name,'version',a.version,'runId',r.id,'antes',jsonb_build_object('preservados',true),'despues',jsonb_build_object('synthetic',true,'grupos',(select count(*) from demo_groups g where g.activity=a.name)))
 from mc_private.activities a cross join mc_private.demo_runs r where r.id='ensayo-16s-20261119' and a.name in(select activity from demo_groups);
insert into mc_private.receipts(activity,id,actor,hash,result)
 select a.activity,'demo_20261119_'||md5(a.activity),r.owner_uid,md5(a.activity||r.id),jsonb_build_object('ok',true,'synthetic',true,'runId',r.id,'sheetsStatus','pending')
 from (select distinct activity from demo_groups)a cross join mc_private.demo_runs r where r.id='ensayo-16s-20261119';
insert into mc_private.outbox(activity,version,updated_at)
 select name,version,now() from mc_private.activities where name in(select activity from demo_groups)
 on conflict(activity)do update set version=excluded.version,updated_at=excluded.updated_at;
do $verify$
begin
 if (select count(*) from demo_rows where kind='padron')<>2760 or (select count(*) from demo_rows where kind='asistencia')<>88320 or (select count(*) from demo_rows where kind='evaluaciones')<>11040 then raise exception 'Conteos incorrectos; revertir transacción.';end if;
 if exists(select 1 from mc_private.demo_runs d cross join lateral jsonb_array_elements(d.baseline->'records') b left join mc_private.records r on r.activity=b->>'activity' and r.kind=b->>'kind' and r.key=b->'key' where d.id='ensayo-16s-20261119' and r.data is distinct from b->'data')then raise exception 'Cambió un documento previo.';end if;
end $verify$;
commit;
select 'ensayo-16s-20261119' as ensayo,kind,sum(jsonb_array_length(data->'rows')) as filas,count(distinct activity) as actividades from mc_private.demo_run_records where run_id='ensayo-16s-20261119' group by kind order by kind;
