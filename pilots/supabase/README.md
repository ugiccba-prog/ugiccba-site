# Muni360: piloto aislado de Supabase

No sustituye el ensayo de Apps Script ni constituye una migración de datos. Solo prueba apertura de un grupo y guardado de asistencia, con 1500 participantes ficticios.

## Alcance

- PostgreSQL guarda asistencia, revisión, recibo, auditoría y trabajo pendiente para Sheets en una transacción.
- Las consultas de apertura devuelven el grupo y la fecha solicitados. No cargan toda la historia.
- El bloqueo se limita a la solicitud y a la clase modificada. No hay bloqueo global del club.
- Se conserva Firebase Google Sign-In. Los permisos de este piloto se autorizan aparte en una tabla privada; no se importan usuarios reales.
- Consulta, acceso por actividad, suspensión, vencimiento, padrón y temporada se comprueban en el servidor.
- Cliente con pendiente durable por UID antes del envío, mismo ID al reintentar y descarte por ID. Chrome actualizado con Web Locks; una carga pendiente por cuenta en este piloto.
- Pantalla de prueba con guardado MANUAL, métricas y pruebas explícitas de lectura/concurrencia. No reemplaza el autoguardado ni todos los flujos del producto actual.
- Puente opcional a una planilla NUEVA de Google, fuera del tiempo de guardado. Nunca escribe en las planillas del ensayo activo.

## Ejecución local

Desde esta carpeta, Node 22 o compatible:

```sh
npm install
npm test
```

La dependencia de pruebas PGlite 0.5.16 ejecuta PostgreSQL en WASM. No es una simulación de SQL; tampoco es Supabase hospedado ni sirve para demostrar latencia de red o capacidad concurrente real. Los tests construyen y destruyen una base efímera en memoria. Para escribir el reporte, configurar `MUNI_PILOT_REPORT` con un archivo privado de salida.

Para UI local ejecutar `npm run test:browser`, con Chrome instalado. Puede configurarse `MUNI_CHROME_PATH` o `MUNI_BROWSER_CHANNEL` para el navegador. Se prueban Profe y Consulta a 360/1440 px, guardado, recuperación tras desconexión/recarga y conservación de clima/puntos. Firebase y el gateway HTTP están reemplazados por fixtures locales; la persistencia usa el SQL real en PGlite. No usa el perfil ni cookies del navegador del usuario.

Se generan 75 grupos de 20 participantes en 25 actividades ficticias. La temporada opcional agrega 6000 clases, 120000 asistencias y 6000 auditorías históricas sintéticas. No incluye evaluaciones ni adjuntos.

## Preparación en Supabase real (pendiente de conexión)

1. Usar un proyecto NUEVO de plan gratuito, revisar que no se contrate ningún plan ni cómputo adicional. No aplicar esta migración sobre otra base existente: crea un esquema nuevo y falla si ya existe.
2. Aplicar `sql/001_pilot.sql`, `sql/004_private_guardrails.sql` y `sql/002_fictitious_roster.sql`. El archivo 003 es opcional para medir capacidad y requiere que aún no haya clases. No genera trabajos de proyección de históricos.
3. Configurar la integración oficial Third-Party Auth con el proyecto Firebase correcto. La firma del JWT la valida Supabase; el SQL no sustituye esa validación. El piloto no cambia claims, usuarios ni configuración del Firebase activo.
4. Revisar `mp_private.settings.firebase_project`. Para probar con una cuenta real, el administrador agrega SU UID a `mp_private.principals` con actividades ficticias concretas. Las filas `pilot-teacher`/`pilot-reader` son solo para tests, no credenciales ni cuentas Firebase.
5. Completar `web/config.js` con la URL y clave PÚBLICA del nuevo proyecto y la configuración pública de Firebase. No poner `service_role`, contraseñas ni claves privadas. Se deja vacía en Git por diseño.
6. Servir `web/` en localhost para prueba o en un sitio HTTPS de piloto separado. No desplegar sobre `/muni360/`, `/muni360cyc/` o `/admin/` del ensayo. Verificar el dominio autorizado de Firebase antes del login.
7. Hacer login real; verificar rechazo sin autorización y apertura de las tres agrupaciones de la actividad permitida. No dar acceso por grupo específico: se habilita toda la actividad.

### Modelo de acceso del piloto

Todas las tablas están en un esquema privado, con RLS habilitado, políticas restrictivas de denegación y sin grants de tabla para `anon`/`authenticated`. Los RPCs públicos son SECURITY INVOKER y delegan en funciones SECURITY DEFINER privadas, con `search_path` vacío, nombres cualificados y controles de identidad/permiso en cada llamada. La concesión de USAGE del esquema permite llamar esos helpers autorizados; no permite leer ni escribir sus tablas. No hay funciones para autoaprobarse ni escribir directamente tablas.

El UID de Firebase es texto, no necesariamente UUID. Se usa el `sub` del JWT verificado. Como Firebase normalmente no incluye un claim Postgres `role`, los cuatro RPCs de usuario permiten también `anon`, pero RECHAZAN peticiones sin JWT válido, proyecto, proveedor Google y autorización privada. Esto no hace públicas las tablas. Validar este flujo en el gateway real antes de darlo por aprobado. No se llama al Admin SDK ni se activa Cloud Functions/Blaze para añadir claims.

La comprobación directa de revocación/inhabilitación de Firebase y su tiempo de efecto debe contrastarse con la integración real. El piloto prueba suspensión/vencimiento de permisos propios, no certifica que replique todas las variantes de revocación del backend actual.

## Puente de Sheets, opcional y separado

`tools/SheetsProjector.gs` va en un proyecto Apps Script NUEVO, con Sheets API avanzada v4. Primero ejecutar `crearPlanillaSupabasePiloto`: crea un destino ficticio y registra su ID. Configurar solo en propiedades privadas `SUPABASE_PILOT_URL` y `SUPABASE_PILOT_SERVICE_KEY` (clave de servidor del proyecto ficticio). No compartirla ni copiarla al frontend.

Ejecutar `proyectarSupabasePiloto` manualmente durante el ensayo. Es un registro legible de eventos por participante, con solicitud, fecha, grupo, asistencia, autor y revisión. Verifica la marca del destino, escribe strings literales, lee de vuelta y SOLO entonces confirma el trabajo en la base. Ante respuesta perdida, compara la solicitud antes de repetir. Una copia parcial o editada bloquea el ack para revisión.

Instalar como máximo un trabajador por destino. El script no crea activadores automáticamente. No es todavía el reemplazo completo de las vistas operativas del sistema original. Apps Script se usa aquí únicamente como puente opcional a Sheets; no interviene al abrir ni guardar en la base.

## Medición pendiente en nube

En la misma red y dispositivo, comparar:

1. Apertura fría y 20 aperturas posteriores de un grupo en cada backend. Mediana/p95, errores, bytes y condiciones de red.
2. Guardados confirmados por la base, separando el tiempo de copia a Sheets. Misma carga y patrón de datos; no comparar DB local con Google remoto.
3. Veinte solicitudes sobre una revisión: una confirmación y diecinueve conflictos esperados. El botón de concurrencia usa una sola identidad: todavía faltan varias cuentas reales y grupos distintos.
4. Desconexión antes y después del commit: recuperar el mismo pendiente sin duplicar recibos, auditoría ni copia.
5. Medir la llegada real a una planilla nueva y comprobar identidad/autorización en la API real.

El endpoint de Apps Script actual está basado en una versión anterior y su UI tiene distinta política de autoguardado. La comparación debe registrar esa diferencia, no atribuir toda la demora al proveedor.

## Límites y reversión

El proyecto Free ya tiene datos ficticios y pruebas SQL hospedadas. Sigue pendiente la comparación completa de velocidad por HTTP con Google real y la proyección real; ver RESULTADOS_NUBE.md. La rama conserva evidencia local y hospedada por separado. No afirmar que la migración está hecha ni recomendar pagar basándose solo en PGlite.

Faltan las demás operaciones de Muni360, UI de permisos, legajos, evaluaciones, migración/conservación de identidades e históricos, backups reales del nuevo sistema y ensayo completo. No habilitar deportistas reales aquí.

Reversión del piloto: dejar de servir su carpeta y sus trabajadores. El sistema de ensayo sigue con sus URLs y datos originales. No se borra ninguna base ni backup automáticamente.

Referencias oficiales: https://supabase.com/docs/guides/auth/third-party/firebase-auth · https://supabase.com/docs/guides/database/functions · https://supabase.com/docs/guides/database/postgres/row-level-security
