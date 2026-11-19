# Muni360: preparación de demostración e Inteligencia

Revisión: 19/11/2026. Rama: `dev/muni360-inteligencia-demo`.

## Estado vigente: demostración retirada

El propietario solicitó quitar la carga ficticia y confirmó la retirada final. El 19/11/2026 se ejecutó la retirada selectiva: cero documentos del ensayo permanecen en la base operativa, cero documentos anteriores fueron modificados y las 22 vistas de Sheets quedaron actualizadas. Se conservaron las herramientas, la rama de desarrollo, el manifiesto y la copia privada de resguardo. No se purgaron esos respaldos ni se modificó `main`. Detalle: [retirada del ensayo](muni360-retirada-solicitada.md).

## Estado anterior: demostración cargada en la web

Con autorización explícita del propietario se ejecutaron primero el ensayo con `ROLLBACK` y después la carga con `COMMIT` en Supabase, desde su editor autenticado. Identificador: `ensayo-16s-20261119`. No se cambió `main` ni se desplegó código de aplicación.

La carga confirmó 345 grupos en 22 actividades: 2760 inscripciones, 88320 asistencias y 11040 evaluaciones, distribuidos en 22425 documentos. Ante la coincidencia con Mini A existente de hockey sobre patines, todos los grupos del ensayo usan el sufijo ` · DEMO` en el eje equipo/modalidad; las categorías y los 39 códigos de fútbol se mantienen literalmente. Los nombres de participantes son `DEMO 01` a `DEMO 08` dentro de cada grupo.

La comprobación posterior confirmó **cero documentos anteriores modificados**. Se conservó una copia privada de registros y versiones previos en `mc_private.demo_runs`; el manifiesto y contenido de todos los documentos agregados están en `mc_private.demo_run_records`. Ambas tablas tienen RLS activo y no permiten acceso directo a `public`, `anon` ni `authenticated`. No contienen credenciales. La copia con información previa permanece en la base privada: no se exportó ni se incorporó a Git.

La carga administrativa validada deja auditoría y recibos por actividad, incrementa sus versiones y encola la proyección hacia Sheets. Se revisó el contrato de lectura real con PGlite y después se verificó el portal publicado con la cuenta institucional, fuera del modo de demostración local: Básquet Damas → U13 → A · DEMO → Inicio → Todo el historial muestra ocho integrantes, 69% de asistencia redondeada, 32 evaluaciones y 256 observaciones. No se modificó ninguna asistencia desde la interfaz para hacer esta comprobación.

Acceso: https://ugiccba.com.ar/muni360/deportes/ . Los coordinadores entran con Google y solicitan acceso; el propietario los aprueba desde https://ugiccba.com.ar/muni360/admin/ y asigna sus actividades. No se otorgaron permisos nuevos ni se enviaron invitaciones desde este trabajo.

**Bloqueo de planillas:** la aplicación lee los datos confirmados de Supabase y funciona, pero la copia institucional a Sheets permanece pendiente. Apps Script registró `MANTENIMIENTO_SUPABASE_PENDIENTE` en el ciclo automático de las 18:15. Ejecutar únicamente la función de copia, con la cuenta institucional y sin invocar el envío de avisos, permitió localizar el fallo a las 18:20: `El puente no confirmó mc_worker_jobs`, `SheetsInstitucional.gs`, líneas 21–22. No se confirmó el estado HTTP ni la causa subyacente, por lo que no se atribuye todavía a credenciales, cuotas o tiempo de consulta. No se modificó el trabajador publicado ni se afirmó una sincronización completa.

Validación final: 165 pruebas de aplicación y 61 de servidor aislado aprobadas; paquete público de 26 archivos verificado. La prueba de carga/retirada comprueba cantidades, lectura mediante `mc_service`, preservación de los originales, rechazo a repetir una carga, ausencia de permisos directos y bloqueo de retirada si cambió un documento de prueba.

Retirada preparada, **no ejecutada**: `server/supabase/tools/demo-shared-retire.sql`. Conserva el manifiesto privado y la copia previa, detiene la retirada si hubo cambios o registros nuevos, quita sólo los documentos del lote revisado, mantiene auditoría y versiones y vuelve a encolar las vistas. Si los coordinadores modifican datos de prueba, se requiere reconciliar esas modificaciones antes de retirar. No borrar planillas oficiales ni ejecutar un reinicio general para limpiar este ensayo.

Los apartados siguientes describen la preparación inicial y sus limitaciones antes de autorizar la carga; este estado vigente los actualiza.

## Correcciones de carga pesada y próximos pasos (19/11/2026)

Al consultar el panel con todas las actividades demo cargadas (22 actividades, 345 grupos, 22425 documentos / 102120 filas), se detectaron dos cuellos de botella:

1. **Lectura `O(N²)` en `mc_private.service` (`load`):** el bucle `FOR rec ... LOOP` concatenaba `jsonb_set(state, array[k], (state->k) || ...)` documento por documento, copiando el arreglo completo en cada iteración.
2. **Panel en una sola llamada:** `assets/scripts/muni360-dashboard.js` enviaba todas las actividades seleccionadas juntas en un único `POST /api/dashboard`, y `dashboard.mjs` ejecutaba `load` completo (incluyendo `fichas`, `versions`, `archives` e `identities`) para todas en una sola invocación de Edge Function.

### Cambios aplicados en esta rama

- `server/supabase/sql/013_fast_load_and_dashboard.sql`: reemplaza el bucle `jsonb_set` de `mc_private.service` (`load`) por agregación directa en SQL (`jsonb_agg` con `with ordinality`), y agrega `scope = 'dashboard'` para devolver sólo `padron`, `asistencia`, `evaluaciones`, `sesiones` y `actor`.
- `server/supabase/functions/muni360/dashboard.mjs`: pasa `scope: 'dashboard'` en `service('load', ...)`.
- `assets/scripts/muni360-dashboard.js` (y paquete reconstruido en `muni360/`): consulta `/api/dashboard` en tandas de a 2 actividades mostrando progreso (`X/Y`), evitando superar los límites de CPU/memoria/timeout de una sola invocación.

### Qué aplicar al actualizar en producción/ensayo

1. Ejecutar `server/supabase/sql/013_fast_load_and_dashboard.sql` en el SQL Editor de Supabase.
2. Desplegar la Edge Function `muni360` actualizada (`server/supabase/functions/muni360/`).
3. Publicar el sitio estático actualizado (`assets/scripts/muni360-dashboard.js` y `muni360/`).

### Próximos módulos a definir

- **Módulo de Inteligencia:** reglas de alertas (ausencias consecutivas, caída de asistencia), intervenciones, revisiones y escalamiento a 48 h calculados en SQL / sobre resúmenes persistidos.
- **Cuestionario para jugadores y jugadoras:** constructor de cuestionarios administrado por Coordinación (por actividad/categoría/período) con respuesta simple para deportistas y proyección agregada hacia Inteligencia.

## Resultado preparado

Catálogo recibido del usuario: 16 deportes, 22 actividades al separar las ramas que ya existen en el catálogo institucional. No se reemplaza el catálogo oficial de 25 actividades: Handball, COYFD y Colonia quedan fuera del pedido de estos 16 deportes.

Se generan 2760 inscripciones sintéticas, 88320 asistencias y 11040 evaluaciones en 16 semanas (27/07–12/11/2026), dos encuentros semanales y ocho participantes por grupo. Nombres DEMO, DNI vacío, identificadores estables sin datos personales. Las semanas 1–4 tienen asistencia estable, 5–12 caída y 13–16 recuperación de A y persistencia en B. No representan resultados reales del club.

Se preservan literalmente las 39 divisiones de fútbol entregadas: 26 TAFF, cuatro Fútbol 11, cuatro TIFA y cinco femeninas. La categoría conserva su código; el eje equipo identifica la modalidad original, sin agregar A/B a esas divisiones. Los otros deportes usan equipos o grupos A/B. La rama se resuelve mediante la actividad institucional. Gimnasia, patín y deportes con peso/nivel requieren completar dimensiones técnicas antes de una inscripción federativa: este catálogo es de demostración, no una certificación reglamentaria. No se inventan pesos ni equivalencias federativas.

## Conexiones encontradas en código

- `assets/scripts/muni360-config.js`: backend Supabase; Edge Function del proyecto `kaalffshnrkxviqaymhv`; Firebase Auth del proyecto `muni360-ugi-ensayo`.
- `server/supabase/functions/muni360`: verificación de identidad, permisos, operaciones y panel agregado. `domain.mjs` define el contrato usado por el generador; cada asistencia y evaluación pasa por sus validaciones reales.
- `assets/scripts/muni360-dashboard.js` consulta `/api/dashboard` para Coordinación y Dirección UGI; `dashboard.mjs` lee estados compartidos mediante el servicio, sin devolver registros individuales. El generador utiliza su misma función `summarize` para preparar indicadores locales.
- `docs/muni360-planillas.md` identifica Planilla Madre y proyecto Apps Script. `server/supabase/tools/SheetsInstitucional.gs` y el mantenimiento institucional proyectan información hacia Sheets. La documentación establece ejecución cada cinco minutos: no se verificaron los disparadores vivos ni sus credenciales.
- Los comentarios antiguos «100% Google Sheets» dentro del HTML contradicen la configuración vigente; no deben usarse para decidir dónde cargar datos.

Inspección de código y documentación, no verificación autenticada del estado hospedado. No se usaron credenciales de servidor, tokens de usuarios ni se leyeron datos personales de la base.

## Reproducción local

1. `python scripts/prepare-demo-catalog.py` reconstruye `demo/catalogo.json` desde la transcripción recibida.
2. `node scripts/muni360-demo.mjs demo/catalogo.json salida.json` genera datos y paneles locales. La salida debe ser un archivo nuevo: se rechaza sobrescribirlo.
3. Para reiniciar la demostración, generar otro archivo desde el mismo catálogo: los datos y los ID son deterministas.

El JSON contiene `synthetic: true` y `target: local-only`. No es una migración, respaldo ni archivo de importación de producción. No incluye usuarios, permisos, auditorías, recibos ni proyecciones. Las divisiones de una misma actividad se agregan sin reemplazarse. No hay cliente de red ni mecanismo de carga hospedada en el generador.

## Validación ejecutada

- `npm run test:muni360`: 163 pruebas aprobadas, ninguna fallida.
- `npm run check:muni360-public`: 26 archivos públicos verificados.
- `node --test server/supabase/tests/*.test.*`, con `MUNI_PGLITE_MODULE` apuntando al paquete fijado del piloto: 60 pruebas aprobadas, ninguna fallida.
- Dependencias del piloto instaladas con `npm ci --prefix pilots/supabase`.
- Se regeneró el paquete público local para comprobar su integridad. Las diferencias de fin de línea de Windows provocaron inicialmente dos errores; la compilación local resolvió las comprobaciones sin modificar fuentes de la aplicación.

## Pendientes y bloqueos para revisión

Los paneles existentes quedan preparados para ensayos con este contrato compartido; no se agregó una pantalla nueva ni se conectó la demostración al servidor hospedado. Profesores, Coordinación y UGI deben probarse en un entorno de ensayo autenticado, con permisos reales separados por actividad. Falta definir/proveer ese entorno y verificar allí las proyecciones, disparadores, copias y acceso Firebase.

Las alertas de ausencias consecutivas, caída de asistencia, intervenciones y escalamiento tras 48 horas no se implementan con este generador. Se preparan escenarios de asistencia para probarlas; la cola semanal existente no equivale al escalamiento solicitado. Pendiente definir contrato persistente de alerta/revisión/intervención y su proyección antes de incorporar esa funcionalidad. Las evaluaciones generadas tienen dos variables de prueba, no reemplazan la configuración deportiva real.

No se modificó `main`, no se ejecutaron migraciones remotas, no se cargaron datos en Supabase/Sheets y no se desplegó producción. La carga futura necesita un adaptador revisado que use las operaciones autorizadas y conserve auditoría, recibos, revisiones y proyecciones; no insertar estos estados directamente en tablas.

## Solicitud posterior: experiencia compartida en la web

El propietario pidió usar el sistema compartido con datos ficticios y aprobar personalmente los accesos cuando los coordinadores los soliciten. Autorizó explícitamente el ingreso con la cuenta institucional. Se verificó en Chrome el ingreso real como Dirección UGI y la existencia de datos previos; no se guardaron tokens ni se exportaron registros personales.

Se agregó `scripts/muni360-demo-plan.mjs`: prepara operaciones del contrato existente y un manifiesto de grupos, sólo cuando se proporcionan lecturas completas de las actividades. Rechaza cargar cualquier grupo que ya tenga padrón, asistencias o evaluaciones, incluso ante diferencias de mayúsculas. No ejecuta peticiones ni escrituras. Un plan requiere revalidación inmediatamente antes de ejecutar; no evita por sí mismo cambios concurrentes.

Para el catálogo completo se requieren 22425 operaciones individuales (345 altas de grupo, 11040 clases, 11040 evaluaciones). Es necesario diseñar/revisar ejecución por lotes, recibos persistentes, recuperación de fallos y límites de servicio antes de iniciar una carga larga. El plan todavía no es un importador desplegado.

La revisión del dominio confirmó que `BAJA_PADRON` conserva asistencias y evaluaciones. Borrar las vistas de Sheets tampoco retira datos de Supabase. No se promete una limpieza completa mediante ninguna de esas acciones. El acceso de Dirección en la aplicación no equivale a acceso administrativo al servidor: Supabase Dashboard mostró la pantalla de ingreso. Pendiente autenticar esa administración para preparar una separación del ensayo y una retirada verificable que preserve los datos existentes. No se inició la carga ni se cambiaron permisos.
