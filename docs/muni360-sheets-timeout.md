# Diagnóstico de sincronización a Sheets — 19/11/2026

Actualización posterior: a pedido del propietario se retiró la carga de demostración. El trabajador existente confirmó nuevamente las 22 vistas y la comprobación final no encontró actividades pendientes. No se aplicó el parche de este informe. Se conserva preparado porque el problema de acumulación puede reaparecer al crecer una temporada real. Véase [retirada del ensayo](muni360-retirada-solicitada.md).

## Causa confirmada

En los registros autenticados de Supabase se observan llamadas de Google Apps Script a `/rest/v1/rpc/mc_worker_jobs` que responden HTTP 500, junto con errores PostgreSQL SQLSTATE `57014`: `canceling statement due to statement timeout`. Se repiten en cada ciclo de cinco minutos. Las llamadas a `mc_source_tasks` responden 200. Por lo tanto, el fallo observado es el límite de ejecución de la consulta que prepara las vistas, no una prueba de credenciales inválidas ni un fallo de escritura de Google Sheets.

La consulta a los roles confirmó `statement_timeout=3s` para `anon`, `8s` para `authenticated` y `8s` para `authenticator`. El trabajador institucional llama con la clave pública y su credencial privada de mantenimiento, conservando la validación en `mc_private.worker_auth`; no se accedió al valor de esa credencial.

El código versionado de `worker_jobs` acumula el estado de cada actividad mediante concatenaciones repetidas de JSONB y procesa hasta cinco actividades por llamada habitual. La copia de cada arreglo creciente por documento provoca trabajo que aumenta desproporcionadamente con una temporada completa. Esta es la explicación del código compatible con el timeout confirmado; la velocidad del servidor hospedado después de la corrección aún debe medirse.

## Corrección preparada para revisión

`server/supabase/tools/optimize-worker-jobs.sql` reemplaza únicamente la implementación privada de `worker_jobs`, con la misma firma. Agrega las filas en una pasada por actividad y limita a una actividad por llamada. Conserva autenticación, saneamiento de DNI/legajos privados, archivos históricos, auditoría redactada, control de versiones y bloqueo de lectura. No cambia claves, permisos, roles, tablas de negocio ni el límite de tiempo del servidor. Los trabajos permanecen pendientes hasta que el trabajador verifica las planillas y confirma sus versiones mediante el mecanismo existente.

Es un parche operativo preparado, **no aplicado** al servidor publicado. La restricción original del propietario exige revisión antes de desplegar cambios de producción.

## Prueba aislada

`server/supabase/tests/worker-jobs-performance.test.mjs` compara el contrato antes/después, rechaza credenciales inválidas, comprueba que no se devuelve DNI y que no se borran registros ni trabajos pendientes. Carga el catálogo completo de demostración y coloca primero Rugby Caballeros: 256 integrantes, 8192 asistencias y 1024 evaluaciones. Tiempo medido de la consulta optimizada en PGlite local: aproximadamente 76 ms; no es una medición del servidor hospedado.

Tras aprobar el parche: verificar la definición hospedada antes de reemplazarla, conservarla para reversión, aplicar el cambio y probar únicamente la función de copia a Sheets. Confirmar por actividad `projected_version >= version`, sin marcar trabajos manualmente como sincronizados. Comprobar una planilla por lectura real. No invocar el envío de correos como parte del ensayo técnico. Si una actividad por ciclo no alcanza el ritmo requerido, ajustar la frecuencia o un procesamiento acotado después de medir, sin elevar límites globales por defecto.
