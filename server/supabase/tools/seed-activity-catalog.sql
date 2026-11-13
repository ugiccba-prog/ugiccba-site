-- Seed the official 25 Muni360 activities as enabled, initially empty activities.
-- Safe to rerun: existing activity records and all non-owner permissions are preserved.
begin;
do $seed$
declare
  v_catalog jsonb := jsonb_build_array(
    'Básquet Caballeros',
    'Básquet Damas',
    'COYFD',
    'Cestoball',
    'Colonia',
    'Fútbol Caballeros',
    'Fútbol Damas',
    'Gimnasia Artística',
    'Gimnasia Rítmica',
    'Golf',
    'Handball',
    'Hockey sobre Césped Caballeros',
    'Hockey sobre Césped Damas',
    'Hockey sobre Patines Caballeros',
    'Hockey sobre Patines Damas',
    'Judo',
    'Karate',
    'Natación Artística',
    'Patín Artístico',
    'Pelota Paleta',
    'Rugby Caballeros',
    'Rugby Damas',
    'Tenis',
    'Vóley Caballeros',
    'Vóley Damas'
  );
  v_owner text;
begin
  if (select mode from mc_private.settings where id) <> 'ready' then
    raise exception 'Muni360 debe estar en modo ready para cargar el catálogo.';
  end if;
  if jsonb_array_length(v_catalog) <> 25 then
    raise exception 'El catálogo debe tener 25 actividades.';
  end if;

  insert into mc_private.activities(name, epoch, version, projected_version, enabled)
  select value, 1, 0, 0, true
  from jsonb_array_elements_text(v_catalog) as x(value)
  on conflict (name) do nothing;

  update mc_private.settings
  set areas = v_catalog
  where id;

  select owner_uid into v_owner
  from mc_private.settings
  where id;

  update mc_private.users
  set record = record || jsonb_build_object('areas', v_catalog)
  where uid = v_owner;

  if not found then
    raise exception 'No se encontró el registro de Dirección para actualizar el catálogo.';
  end if;

  if (
    select count(*)
    from mc_private.activities
    where name in (select jsonb_array_elements_text(v_catalog))
      and enabled
  ) <> 25 then
    raise exception 'No se activaron las 25 actividades del catálogo.';
  end if;
end
$seed$;
commit;
