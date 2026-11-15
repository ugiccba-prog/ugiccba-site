begin;
-- The institutional worker can prepare missing views without changing records,
-- activity versions, registered destinations or access permissions.
create or replace function mc_private.prepare_sheet_templates(p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_areas jsonb; v_targets jsonb;
begin
  perform mc_private.source_auth(p_secret);
  select areas into v_areas from mc_private.settings where id and mode='ready';
  if v_areas is null then raise exception 'Muni360 debe estar activo para preparar las plantillas.'; end if;
  perform 1 from mc_private.activities a where v_areas ? a.name order by a.name for share;
  if exists(select 1 from jsonb_array_elements_text(v_areas) x(name)
    left join mc_private.activities a on a.name=x.name where a.name is null or not a.enabled)
  then raise exception 'El catálogo contiene actividades sin habilitar.'; end if;
  insert into mc_private.outbox(activity,version)
  select a.name,a.version from mc_private.activities a
  left join mc_private.sheet_targets t on t.activity=a.name
  where v_areas ? a.name and a.enabled and t.sheet_id is null
  on conflict(activity) do update set version=greatest(mc_private.outbox.version,excluded.version);
  select coalesce(jsonb_agg(jsonb_build_object('activity',a.name,'sheet_id',t.sheet_id) order by a.name),'[]'::jsonb)
  into v_targets from mc_private.activities a left join mc_private.sheet_targets t on t.activity=a.name
  where v_areas ? a.name and a.enabled;
  return jsonb_build_object('targets',v_targets,'pending',
    (select count(*) from jsonb_array_elements(v_targets) t where t->>'sheet_id' is null));
end $$;
revoke all on function mc_private.prepare_sheet_templates(text) from public,anon,authenticated;
grant execute on function mc_private.prepare_sheet_templates(text) to anon,authenticated;
create or replace function public.mc_prepare_sheet_templates(p_secret text)
returns jsonb language sql security invoker set search_path='' as $$
  select mc_private.prepare_sheet_templates(p_secret);
$$;
revoke all on function public.mc_prepare_sheet_templates(text) from public,anon,authenticated;
grant execute on function public.mc_prepare_sheet_templates(text) to anon,authenticated;
commit;
