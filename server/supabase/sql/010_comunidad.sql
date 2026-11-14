-- Esquema Comunidad Muni aislado de mc_private.
-- Horarios fijos viven únicamente en el catálogo estático (comunidad/catalogo.js).
begin;

create schema if not exists comunidad;

drop table if exists comunidad.horarios_base cascade;

-- 1. Cartelera pública de avisos, partidos, cambios y suspensiones
create table if not exists comunidad.novedades (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  autor_uid text not null,
  autor_nombre text not null,
  actividad text not null,
  categoria text not null default '',
  equipo text not null default '',
  tipo text not null check (tipo in ('Partido', 'Entrenamiento', 'Cambio', 'Suspension', 'Aviso')),
  urgente boolean not null default false,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 160),
  detalle text not null check (char_length(btrim(detalle)) between 3 and 2000),
  fecha_evento date,
  hora_evento text not null default '',
  lugar text not null default '',
  activa boolean not null default true,
  enviar_notificacion boolean not null default false,
  notificacion_estado jsonb not null default '{"enviados":[],"errores":[]}'::jsonb
);

alter table comunidad.novedades add column if not exists enviar_notificacion boolean not null default false;
alter table comunidad.novedades add column if not exists notificacion_estado jsonb not null default '{"enviados":[],"errores":[]}'::jsonb;
alter table comunidad.novedades alter column hora_evento set default '';
alter table comunidad.novedades alter column lugar set default '';
update comunidad.novedades set tipo = 'Aviso' where tipo = 'Comunicado';
update comunidad.novedades set hora_evento = '' where hora_evento is null;
update comunidad.novedades set lugar = '' where lugar is null;
alter table comunidad.novedades drop constraint if exists novedades_tipo_check;
alter table comunidad.novedades add constraint novedades_tipo_check
  check (tipo in ('Partido', 'Entrenamiento', 'Cambio', 'Suspension', 'Aviso'));

create index if not exists idx_novedades_feed on comunidad.novedades (activa, creado_at desc);

-- 2. Suscripciones personales (todo un deporte, deporte+categoría, o deporte+categoría+equipo)
create table if not exists comunidad.suscripciones (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  email text not null,
  actividad text not null,
  categoria text not null default '',
  equipo text not null default '',
  canal_push boolean not null default true,
  canal_email boolean not null default false,
  creado_at timestamptz not null default now(),
  unique (uid, actividad, categoria, equipo)
);

-- 3. Tokens de dispositivos para notificaciones Web Push (FCM / navegador)
create table if not exists comunidad.dispositivos (
  token text primary key,
  uid text not null,
  plataforma text not null default 'web',
  actualizado_at timestamptz not null default now()
);

-- Seguridad RLS obligatoria en las tres tablas
alter table comunidad.novedades enable row level security;
alter table comunidad.suscripciones enable row level security;
alter table comunidad.dispositivos enable row level security;

revoke all on table comunidad.novedades, comunidad.suscripciones, comunidad.dispositivos from public, anon, authenticated;
grant usage on schema comunidad to anon, authenticated, service_role;
grant select (
  id, creado_at, autor_nombre, actividad, categoria, equipo,
  tipo, urgente, titulo, detalle, fecha_evento, hora_evento, lugar, activa, enviar_notificacion
) on table comunidad.novedades to anon, authenticated;
grant all on all tables in schema comunidad to service_role;

drop policy if exists "Lectura publica novedades" on comunidad.novedades;
create policy "Lectura publica novedades" on comunidad.novedades
  for select to anon, authenticated
  using (activa = true);

drop policy if exists "Denegar directo suscripciones" on comunidad.suscripciones;
create policy "Denegar directo suscripciones" on comunidad.suscripciones
  as restrictive for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "Denegar directo dispositivos" on comunidad.dispositivos;
create policy "Denegar directo dispositivos" on comunidad.dispositivos
  as restrictive for all to anon, authenticated
  using (false) with check (false);

-- Funciones de servicio (solo service_role via Edge Function)
create or replace function comunidad.catalogo_actividades() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'Básquet Caballeros', 'Básquet Damas', 'COYFD', 'Cestoball', 'Colonia',
    'Fútbol Caballeros', 'Fútbol Damas', 'Gimnasia Artística', 'Gimnasia Rítmica',
    'Golf', 'Handball', 'Hockey sobre Césped Caballeros', 'Hockey sobre Césped Damas',
    'Hockey sobre Patines Caballeros', 'Hockey sobre Patines Damas', 'Judo', 'Karate',
    'Natación Artística', 'Patín Artístico', 'Pelota Paleta',
    'Rugby Caballeros', 'Rugby Damas', 'Tenis', 'Vóley Caballeros', 'Vóley Damas'
  ]::text[];
$$;

create or replace function comunidad.service(p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_catalog text[] := comunidad.catalogo_actividades();
  v_uid text := nullif(btrim(coalesce(p->>'uid', '')), '');
  v_email text := btrim(coalesce(p->>'email', ''));
  v_nombre text := btrim(coalesce(p->>'nombre', v_email, ''));
  v_settings mc_private.settings%rowtype;
  v_user jsonb;
  v_is_active boolean := false;
  v_is_coord boolean := false;
  v_publish_areas jsonb := '[]'::jsonb;
  v_act text;
  v_cat text;
  v_eq text;
  v_tipo text;
  v_titulo text;
  v_detalle text;
  v_fecha date;
  v_hora text;
  v_lugar text;
  v_urgente boolean;
  v_enviar boolean;
  v_row comunidad.novedades%rowtype;
  v_targets jsonb := '[]'::jsonb;
  v_subs jsonb := '[]'::jsonb;
  v_dev_count integer := 0;
  v_token text;
begin
  if p_action = 'feed' then
    return jsonb_build_object(
      'avisos',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'creado_at', x.creado_at,
          'autor_nombre', x.autor_nombre,
          'actividad', x.actividad,
          'categoria', x.categoria,
          'equipo', x.equipo,
          'tipo', x.tipo,
          'urgente', x.urgente,
          'titulo', x.titulo,
          'detalle', x.detalle,
          'fecha_evento', x.fecha_evento,
          'hora_evento', x.hora_evento,
          'lugar', x.lugar,
          'enviar_notificacion', x.enviar_notificacion
        ))
        from (
          select * from comunidad.novedades
          where activa = true
          order by urgente desc, creado_at desc, id desc
          limit 100
        ) x
      ), '[]'::jsonb)
    );
  end if;

  if v_uid is null then
    raise exception using errcode = '42501', message = 'Ingresá con Google para continuar.';
  end if;

  -- Determina permisos de coordinador leyendo mc_private sin crear ni alterar usuarios.
  select * into v_settings from mc_private.settings where id;
  select record into v_user from mc_private.users where uid = v_uid;

  v_is_active := v_user is not null
    and v_user->>'status' = 'activo'
    and (v_user->>'expiresAt' is null or (v_user->>'expiresAt')::timestamptz > now());

  v_is_coord := v_is_active and (
    v_uid = v_settings.owner_uid
    or v_user->>'rol' in ('Dirección UGI', 'Coordinación')
  );

  if v_is_coord then
    v_publish_areas := coalesce((
      select jsonb_agg(a) from (
        select 'General'::text as a
        union all
        select val from jsonb_array_elements_text(
          case
            when v_uid = v_settings.owner_uid then coalesce(v_settings.areas, '[]'::jsonb)
            else coalesce(v_user->'areas', '[]'::jsonb)
          end
        ) as val
        where val = any(v_catalog)
      ) s
    ), '["General"]'::jsonb);
  end if;

  if p_action = 'session' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'actividad', s.actividad,
      'categoria', s.categoria,
      'equipo', s.equipo,
      'canal_push', s.canal_push,
      'creado_at', s.creado_at
    ) order by s.creado_at desc, s.actividad, s.categoria, s.equipo), '[]'::jsonb)
    into v_subs
    from comunidad.suscripciones s
    where s.uid = v_uid;

    select count(*)::integer into v_dev_count
    from comunidad.dispositivos d
    where d.uid = v_uid;

    return jsonb_build_object(
      'profile', jsonb_build_object(
        'uid', v_uid,
        'email', v_email,
        'nombre', v_nombre,
        'rol', case when v_is_active then coalesce(v_user->>'rol', 'Usuario') else 'Comunidad' end,
        'canPublish', v_is_coord,
        'publishAreas', v_publish_areas
      ),
      'suscripciones', v_subs,
      'dispositivosCount', v_dev_count
    );
  end if;

  if p_action = 'subscribe' then
    v_act := btrim(coalesce(p->>'actividad', ''));
    v_cat := btrim(coalesce(p->>'categoria', ''));
    v_eq := btrim(coalesce(p->>'equipo', ''));
    if v_eq <> '' and v_cat = '' then
      raise exception using errcode = '22023', message = 'Indicá una categoría cuando elegís un equipo.';
    end if;
    if v_act <> 'General' and not (v_act = any(v_catalog)) then
      raise exception using errcode = '22023', message = 'Actividad inválida.';
    end if;

    insert into comunidad.suscripciones (uid, email, actividad, categoria, equipo, canal_push, canal_email)
    values (v_uid, v_email, v_act, v_cat, v_eq, coalesce((p->>'canal_push')::boolean, true), false)
    on conflict (uid, actividad, categoria, equipo)
    do update set email = excluded.email, canal_push = excluded.canal_push;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'actividad', s.actividad,
      'categoria', s.categoria,
      'equipo', s.equipo,
      'canal_push', s.canal_push,
      'creado_at', s.creado_at
    ) order by s.creado_at desc, s.actividad, s.categoria, s.equipo), '[]'::jsonb)
    into v_subs
    from comunidad.suscripciones s
    where s.uid = v_uid;

    return jsonb_build_object('suscripciones', v_subs);
  end if;

  if p_action = 'unsubscribe' then
    delete from comunidad.suscripciones
    where id = nullif(btrim(coalesce(p->>'id', '')), '')::uuid
      and uid = v_uid;

    if not found then
      raise exception using errcode = '42501', message = 'No se encontró esa suscripción en tu cuenta.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'actividad', s.actividad,
      'categoria', s.categoria,
      'equipo', s.equipo,
      'canal_push', s.canal_push,
      'creado_at', s.creado_at
    ) order by s.creado_at desc, s.actividad, s.categoria, s.equipo), '[]'::jsonb)
    into v_subs
    from comunidad.suscripciones s
    where s.uid = v_uid;

    return jsonb_build_object('suscripciones', v_subs);
  end if;

  if p_action = 'register_device' then
    v_token := btrim(coalesce(p->>'token', ''));
    if char_length(v_token) < 16 or char_length(v_token) > 4096 then
      raise exception using errcode = '22023', message = 'Token de dispositivo inválido.';
    end if;

    insert into comunidad.dispositivos (token, uid, plataforma, actualizado_at)
    values (v_token, v_uid, left(coalesce(nullif(btrim(p->>'plataforma'), ''), 'web'), 40), now())
    on conflict (token) do update
      set uid = excluded.uid,
          plataforma = excluded.plataforma,
          actualizado_at = now();

    select count(*)::integer into v_dev_count from comunidad.dispositivos where uid = v_uid;
    return jsonb_build_object('registered', true, 'dispositivosCount', v_dev_count);
  end if;

  if p_action = 'publish' then
    if not v_is_coord then
      raise exception using errcode = '42501', message = 'Sólo coordinación autorizada puede publicar avisos.';
    end if;

    v_act := btrim(coalesce(p->>'actividad', ''));
    v_cat := btrim(coalesce(p->>'categoria', ''));
    v_eq := btrim(coalesce(p->>'equipo', ''));
    v_tipo := btrim(coalesce(p->>'tipo', 'Aviso'));
    v_titulo := btrim(coalesce(p->>'titulo', ''));
    v_detalle := btrim(coalesce(p->>'detalle', ''));
    v_fecha := nullif(btrim(coalesce(p->>'fecha_evento', '')), '')::date;
    v_hora := left(btrim(coalesce(p->>'hora_evento', '')), 40);
    v_lugar := left(btrim(coalesce(p->>'lugar', '')), 120);
    v_urgente := coalesce((p->>'urgente')::boolean, false);
    v_enviar := coalesce((p->>'enviar_notificacion')::boolean, false);

    if v_act <> 'General' and not (v_act = any(v_catalog)) then
      raise exception using errcode = '22023', message = 'Actividad inválida.';
    end if;
    if not (v_publish_areas ? v_act) then
      raise exception using errcode = '42501', message = 'No tenés permiso para publicar avisos en esa actividad.';
    end if;
    if v_act = 'General' then
      v_cat := '';
      v_eq := '';
    end if;
    if v_eq <> '' and v_cat = '' then
      raise exception using errcode = '22023', message = 'Indicá la categoría antes de filtrar por equipo.';
    end if;
    if not (v_tipo = any(array['Partido', 'Entrenamiento', 'Cambio', 'Suspension', 'Aviso']::text[])) then
      raise exception using errcode = '22023', message = 'Tipo de aviso inválido.';
    end if;
    if char_length(v_titulo) < 3 or char_length(v_titulo) > 160 then
      raise exception using errcode = '22023', message = 'El título debe tener entre 3 y 160 caracteres.';
    end if;
    if char_length(v_detalle) < 3 or char_length(v_detalle) > 2000 then
      raise exception using errcode = '22023', message = 'El detalle debe tener entre 3 y 2000 caracteres.';
    end if;

    insert into comunidad.novedades (
      autor_uid, autor_nombre, actividad, categoria, equipo,
      tipo, urgente, titulo, detalle, fecha_evento, hora_evento, lugar,
      activa, enviar_notificacion
    ) values (
      v_uid, v_nombre, v_act, v_cat, v_eq,
      v_tipo, v_urgente, v_titulo, v_detalle, v_fecha, v_hora, v_lugar,
      true, v_enviar
    )
    returning * into v_row;

    if v_enviar then
      select coalesce(jsonb_agg(jsonb_build_object(
        'token', t.token,
        'uid', t.uid,
        'plataforma', t.plataforma
      )), '[]'::jsonb)
      into v_targets
      from (
        select distinct d.token, d.uid, d.plataforma
        from comunidad.suscripciones s
        join comunidad.dispositivos d on d.uid = s.uid
        where s.canal_push = true
          and (v_act = 'General' or s.actividad = v_act)
          and (v_cat = '' or s.categoria = '' or lower(btrim(s.categoria)) = lower(v_cat))
          and (v_eq = '' or s.equipo = '' or lower(btrim(s.equipo)) = lower(v_eq))
        order by d.token
      ) t;
    end if;

    return jsonb_build_object(
      'aviso', jsonb_build_object(
        'id', v_row.id,
        'creado_at', v_row.creado_at,
        'autor_nombre', v_row.autor_nombre,
        'actividad', v_row.actividad,
        'categoria', v_row.categoria,
        'equipo', v_row.equipo,
        'tipo', v_row.tipo,
        'urgente', v_row.urgente,
        'titulo', v_row.titulo,
        'detalle', v_row.detalle,
        'fecha_evento', v_row.fecha_evento,
        'hora_evento', v_row.hora_evento,
        'lugar', v_row.lugar,
        'enviar_notificacion', v_row.enviar_notificacion
      ),
      'destinatarios', v_targets
    );
  end if;

  if p_action = 'record_notifications' then
    if not v_is_coord then
      raise exception using errcode = '42501', message = 'Sin permiso para registrar notificaciones.';
    end if;

    update comunidad.novedades
    set notificacion_estado = jsonb_build_object(
      'enviados', coalesce((
        select jsonb_agg(distinct val)
        from jsonb_array_elements_text(
          coalesce(notificacion_estado->'enviados', '[]'::jsonb) || coalesce(p->'enviados', '[]'::jsonb)
        ) as val
      ), '[]'::jsonb),
      'errores', coalesce(notificacion_estado->'errores', '[]'::jsonb) || coalesce(p->'errores', '[]'::jsonb)
    )
    where id = nullif(btrim(coalesce(p->>'id', '')), '')::uuid
      and autor_uid = v_uid;

    return jsonb_build_object('recorded', true);
  end if;

  if p_action = 'deactivate' then
    if not v_is_coord then
      raise exception using errcode = '42501', message = 'Sólo coordinación autorizada puede archivar avisos.';
    end if;

    select * into v_row from comunidad.novedades where id = nullif(btrim(coalesce(p->>'id', '')), '')::uuid;
    if v_row.id is null then
      raise exception using errcode = 'PT409', message = 'No se encontró el aviso.';
    end if;
    if not (v_publish_areas ? v_row.actividad) then
      raise exception using errcode = '42501', message = 'No tenés permiso para modificar avisos de esa actividad.';
    end if;

    update comunidad.novedades set activa = false where id = v_row.id;
    return jsonb_build_object('deactivated', true, 'id', v_row.id);
  end if;

  raise exception using errcode = '22023', message = 'Acción de comunidad desconocida.';
end$$;

revoke all on function comunidad.catalogo_actividades() from public, anon, authenticated;
grant execute on function comunidad.catalogo_actividades() to service_role;

revoke all on function comunidad.service(text, jsonb) from public, anon, authenticated;
grant execute on function comunidad.service(text, jsonb) to service_role;

create or replace function public.mc_comunidad(p_action text, p jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select comunidad.service(p_action, p);
$$;

revoke all on function public.mc_comunidad(text, jsonb) from public, anon, authenticated;
grant execute on function public.mc_comunidad(text, jsonb) to service_role;

commit;
