# Muni360 · Despliegue de cambios en Supabase y Google Sheets

**Fecha de actualización:** 26/11/2026
**Estado:** Pasos 1 (SQL) y 2 (Edge Function `muni360`, los 11 archivos incluyendo `competencia.mjs` y `competencia-config.mjs`) aplicados y verificados en `kaalffshnrkxviqaymhv` el 26/11/2026. Queda para aplicar manualmente en la carpeta privada externa de Apps Script el Paso 3 (`SheetsInstitucional.gs`) si aún no se subió.
**Objetivo:** Guía paso a paso para aplicar en Supabase (SQL + Edge Function) y en el proyecto de Google Apps Script de mantenimiento (`SheetsInstitucional.gs`) los cambios de la revisión integral del 24/11/2026.

---

## Datos del entorno

- **Proyecto Supabase:** `kaalffshnrkxviqaymhv` (`https://kaalffshnrkxviqaymhv.supabase.co`)
- **Edge Function:** `muni360` (fuente en `server/supabase/functions/muni360/`, entrypoint `index.ts`, **`--no-verify-jwt`** porque la función valida criptográficamente el JWT de Firebase mediante `mc_identity`).
- **Puente institucional de Google Sheets (Apps Script):** carpeta local `C:\Users\Juan Machado\Projects\Muni360-Privado\apps-script-institucional` (fuente en `server/supabase/tools/SheetsInstitucional.gs`).
- **Frontend público:** `/muni360/` (generado con `npm run build:muni360-public`, publicado vía rama `main` en GitHub Pages).

---

## Paso 1 · Aplicar SQL en Supabase

Ejecutá el siguiente bloque en **Supabase Dashboard → SQL Editor** (o mediante `execute_sql` del MCP de Supabase). Es idempotente (`create or replace function`) y actualiza únicamente las dos funciones modificadas:

1. `public.mc_surveys(p_action text, p jsonb)` (desde `server/supabase/sql/015_surveys.sql`): agrega tope de 500 respuestas por cuestionario y validación del lado servidor de preguntas obligatorias, escala `1–5`, opciones `single`/`multi` y texto en `public_submit`.
2. `mc_private.manage_user_archive(p_action text, p jsonb)` (desde `server/supabase/sql/017_archive_access.sql`): amplía la paginación de `/api/users/list` de 50 a 200 usuarios por página.

```sql
begin;

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
 v_q jsonb;
 v_qid text;
 v_qtype text;
 v_val jsonb;
 v_resp_count integer;
begin
 if p_action='public_get' then
  v_code:=trim(coalesce(p->>'code',''));
  select * into v_survey from mc_private.surveys where public_code=v_code;
  if v_survey.id is null or v_survey.status='draft' then
   raise exception using errcode='PT409',message='Cuestionario no disponible.';
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
   raise exception using errcode='PT409',message='Este cuestionario ya no recibe respuestas.';
  end if;
  select count(*) into v_resp_count from mc_private.survey_responses where survey_id=v_survey.id;
  if v_resp_count>=500 then
   raise exception using errcode='PT409',message='Este cuestionario alcanzó el límite de respuestas.';
  end if;
  for v_q in select * from jsonb_array_elements(coalesce(v_survey.questions,'[]'::jsonb)) loop
   v_qid:=v_q->>'id';
   v_qtype:=v_q->>'type';
   v_val:=coalesce(p->'answers','{}'::jsonb)->v_qid;
   if coalesce((v_q->>'required')::boolean,false) and (
    v_val is null or jsonb_typeof(v_val)='null'
    or (jsonb_typeof(v_val)='string' and btrim(v_val#>>'{}')='')
    or (jsonb_typeof(v_val)='array' and jsonb_array_length(v_val)=0)
   ) then
    raise exception using errcode='22023',message='Respondé las preguntas obligatorias.';
   end if;
   if v_val is not null and jsonb_typeof(v_val)<>'null' then
    if v_qtype='scale' then
     if jsonb_typeof(v_val)<>'number' or (v_val#>>'{}') !~ '^[1-5]$' then
      raise exception using errcode='22023',message='Valor de escala inválido.';
     end if;
    elsif v_qtype='single' then
     if jsonb_typeof(v_val)<>'string' or (btrim(v_val#>>'{}')<>'' and not (coalesce(v_q->'options','[]'::jsonb) ? (v_val#>>'{}'))) then
      raise exception using errcode='22023',message='Opción inválida.';
     end if;
    elsif v_qtype='multi' then
     if jsonb_typeof(v_val)<>'array' or exists(select 1 from jsonb_array_elements_text(v_val) as opt where not (coalesce(v_q->'options','[]'::jsonb) ? opt)) then
      raise exception using errcode='22023',message='Opción múltiple inválida.';
     end if;
    elsif v_qtype='text' then
     if jsonb_typeof(v_val)<>'string' then
      raise exception using errcode='22023',message='Respuesta de texto inválida.';
     end if;
    end if;
   end if;
  end loop;
  insert into mc_private.survey_responses(survey_id,answers,submitted_at)
  values(v_survey.id,coalesce(p->'answers','{}'::jsonb),v_now);
  perform mc_private.surveys_enqueue_outbox(v_survey.activity,v_now);
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
  perform mc_private.surveys_enqueue_outbox(v_survey.activity,v_now);
  return jsonb_build_object('ok',true,'survey',to_jsonb(v_survey));
 end if;

 if p_action='set_status' then
  select * into v_survey from mc_private.surveys where id=p->>'surveyId' for update;
  if v_survey.id is null then raise exception using errcode='PT409',message='Cuestionario inexistente.'; end if;
  if not (v_areas ? v_survey.activity) then raise exception using errcode='42501',message='No tenés acceso a esa actividad.'; end if;
  v_status:=p->>'status';
  if v_status not in ('draft','active','closed') then raise exception using errcode='PT409',message='Estado inválido.'; end if;
  update mc_private.surveys set status=v_status,updated_at=v_now where id=v_survey.id returning * into v_survey;
  perform mc_private.surveys_enqueue_outbox(v_survey.activity,v_now);
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

 raise exception 'Acción de cuestionarios desconocida.';
end$$;

create or replace function mc_private.manage_user_archive(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_uid text;
 actor jsonb;
 target mc_private.users%rowtype;
 previous jsonb;
 updated jsonb;
 event_id text;
 actor_uid text:=p->>'uid';
 archive_view boolean:=coalesce((p->>'archived')::boolean,false);
begin
 select settings.owner_uid into strict owner_uid from mc_private.settings where id;
 select record into actor from mc_private.users where uid=actor_uid for share;
 if actor_uid is distinct from owner_uid or (actor->>'status') is distinct from 'activo'
   or (actor->>'expiresAt')::timestamptz<=now() then
  raise exception using errcode='42501',message='Sólo el propietario administra permisos.';
 end if;

 if p_action='users' then
  return jsonb_build_object(
   'users',coalesce((
    select jsonb_agg(users_page.record||jsonb_build_object('noticeStatus',notice.status) order by users_page.uid)
    from (
     select uid,record from mc_private.users
     where (record ? 'archivedAt')=archive_view
     order by uid limit 200 offset coalesce((p->>'offset')::integer,0)
    ) users_page
    left join lateral (
     select case when status='sending' and claimed_at<now()-interval '15 minutes' then 'review' else status end as status
     from mc_private.access_notices where uid=users_page.uid
     order by created_at desc,id desc limit 1
    ) notice on true
   ),'[]'::jsonb),
   'total',(select count(*) from mc_private.users where (record ? 'archivedAt')=archive_view)
  );
 end if;

 if p->>'target'=owner_uid then
  raise exception using errcode='42501',message='El propietario no se modifica desde el panel.';
 end if;
 select * into target from mc_private.users where uid=p->>'target' for update;
 previous:=target.record;
 if previous is null or coalesce((previous->>'revision')::bigint,0) is distinct from (p->>'revision')::bigint then
  raise exception using errcode='PT409',message='Los permisos cambiaron. Actualizá.';
 end if;

 if p_action='updateUser' then
  if previous ? 'archivedAt' then
   raise exception using errcode='PT409',message='Restaurá el acceso antes de editar sus permisos.';
  end if;
  return mc_private.service(p_action,p);
 end if;

 if archive_view then
  if previous ? 'archivedAt' then
   raise exception using errcode='PT409',message='El acceso ya está archivado.';
  end if;
  if previous->>'status'='activo' and coalesce((previous->>'expiresAt')::timestamptz>now(),true) then
   raise exception using errcode='PT409',message='Suspendé el acceso vigente antes de archivarlo.';
  end if;
  updated:=previous||jsonb_build_object('archivedAt',now());
 else
  if not (previous ? 'archivedAt') then
   raise exception using errcode='PT409',message='El acceso ya está en el listado principal.';
  end if;
  updated:=previous-'archivedAt';
 end if;
 updated:=updated||jsonb_build_object('status','suspendido','version',gen_random_uuid()::text,'revision',(p->>'revision')::bigint+1);
 update mc_private.users set record=updated where uid=target.uid;
 event_id:=gen_random_uuid()::text;
 insert into mc_private.permission_history(id,event) values(event_id,jsonb_build_object(
  'id',event_id,'fecha',now(),'actor',actor_uid,'autor',actor->>'nombre','target',previous->>'email',
  'antes',previous,'despues',updated,'motivo',case when archive_view then 'Acceso archivado' else 'Acceso restaurado como suspendido' end
 ));
 return jsonb_build_object('user',updated,'authorizationUpdated',true);
end$$;

commit;
```

### Comprobación en SQL

```sql
select
  n.nspname || '.' || p.proname as fn,
  (p.prosrc like '%v_resp_count>=500%') as has_survey_validation,
  (p.prosrc like '%limit 200%') as has_200_limit
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname = 'mc_surveys')
   or (n.nspname = 'mc_private' and p.proname = 'manage_user_archive');
```

Resultado esperado:
- `public.mc_surveys`: `has_survey_validation = true`
- `mc_private.manage_user_archive`: `has_200_limit = true`

---

## Paso 2 · Desplegar la Edge Function `muni360` en Supabase

El cambio en `server/supabase/functions/muni360/core.mjs` actualiza `nextCursor` de `/api/users/list` a bloques de `200` usuarios.

### Archivos de la función (los 11 archivos deben subirse juntos)

Desde `server/supabase/functions/muni360/`:
- `index.ts` (entrypoint)
- `core.mjs`
- `competencia.mjs`
- `competencia-config.mjs`
- `domain.mjs`
- `policy.mjs`
- `dashboard.mjs`
- `presence.mjs`
- `inteligencia.mjs`
- `surveys.mjs`
- `comunidad.mjs`

### Con Supabase CLI (PowerShell)

```powershell
npx supabase functions deploy muni360 --project-ref kaalffshnrkxviqaymhv --no-verify-jwt
```

*(Si usás el MCP de Supabase desde ChatGPT o Antigravity: `deploy_edge_function` con `project_id: "kaalffshnrkxviqaymhv"`, `name: "muni360"`, `entrypoint_path: "index.ts"`, `verify_jwt: false`, enviando los 11 archivos del directorio `server/supabase/functions/muni360/`).*

---

## Paso 3 · Actualizar Google Sheets (`SheetsInstitucional.gs`) en Apps Script

El archivo `server/supabase/tools/SheetsInstitucional.gs` organiza en `estilosYOrdenSheetsUGI` las pestañas `Asist · <grupo>` activas después de `AsistenciaPorGrupo` y mueve las vacías de temporada anterior (`Sin registros de esta temporada`) al final, antes de `EstadoSync`.

1. Copiar `server/supabase/tools/SheetsInstitucional.gs` al proyecto privado de mantenimiento `C:\Users\Juan Machado\Projects\Muni360-Privado\apps-script-institucional` (o reemplazar el contenido de `SheetsInstitucional` en el editor de Google Apps Script con la cuenta propietaria).
2. Si se usa `clasp`:
   ```powershell
   clasp push
   ```
3. No hace falta recrear los activadores de 5 minutos existentes ni cambiar credenciales en Propiedades del script (`UGI_SUPABASE_MAINTENANCE_KEY`).

*(Nota: si también usás la plantilla `SheetsCompleto.gs` en algún proyecto de prueba, ya quedó sincronizada en `server/supabase/tools/SheetsCompleto.gs` con la misma lógica).*

---

## Paso 4 · Comprobación posterior al despliegue

1. En el repo local (si también publicás frontend):
   ```powershell
   npm run check:muni360-public
   npm run lint:js
   npm run test:muni360
   ```
2. Verificación rápida de la Edge Function publicada (PowerShell):
   ```powershell
   $r = Invoke-WebRequest -Uri "https://kaalffshnrkxviqaymhv.supabase.co/functions/v1/muni360" `
     -Method POST -ContentType "text/plain;charset=UTF-8" `
     -Body '{"path":"/api/comunidad/feed"}' -SkipHttpErrorCheck
   $r.StatusCode
   $r.Content
   ```
   Debe devolver HTTP `200` y `"backendVersion":"supabase-1.0.0"`.
3. En `/muni360/admin/` (con sesión de Dirección): abrir el listado, comprobar que carga usuarios y filtro **Archivados** sin errores.
4. En un cuestionario activo de `/muni360/encuesta/`: intentar enviar sin completar una pregunta obligatoria o con datos alterados y verificar que responde error de validación (`400` / `VALIDACION`).
