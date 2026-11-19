-- Read-only preflight and post-retirement check. Returns counts, no personal data.
select d.id,d.status,
 (select count(*) from mc_private.demo_run_records m where m.run_id=d.id) as documentos_del_manifiesto,
 (select count(*) from mc_private.demo_run_records m join mc_private.records r
  on r.activity=m.activity and r.kind=m.kind and r.key=m.key where m.run_id=d.id) as documentos_demo_en_operacion,
 (select count(*) from mc_private.demo_run_records m join mc_private.records r
  on r.activity=m.activity and r.kind=m.kind and r.key=m.key
  where m.run_id=d.id and r.data is distinct from m.data) as documentos_demo_modificados,
 (select count(*) from jsonb_array_elements(d.baseline->'records') b
  left join mc_private.records r on r.activity=b->>'activity' and r.kind=b->>'kind' and r.key=b->'key'
  where r.data is distinct from b->'data') as documentos_previos_modificados,
 (select count(*) from mc_private.activities a
  where a.name in(select activity from mc_private.demo_run_records m where m.run_id=d.id)
   and a.projected_version<a.version) as actividades_pendientes_sheets
from mc_private.demo_runs d where d.id='ensayo-16s-20261119';
