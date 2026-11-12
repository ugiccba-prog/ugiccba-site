# Muni360 — Supabase y mantenimiento institucional

## Estado publicado, 12/11/2026

Los datos del ensayo fueron importados y comparados. Con confirmación explícita del propietario se ejecutó `tools/activate-verified.sql`: validación exacta y habilitación en una transacción. La base está en `ready`, con las dos actividades habilitadas. Firebase Hosting fue publicado en el sitio habitual el 12/11/2026, aproximadamente a las 10:00 de Argentina. Los tres portales responden HTTP 200 y la configuración publicada usa Supabase.

Se recuperaron en la PC del club los cambios sin subir de la PC de casa. La rama de continuidad es `continuacion/supabase-club-20261112`; la copia de trabajo está en `C:\Users\Juan Machado\Projects\muni360-supabase-migracion`. El repositorio original y la copia de casa se conservan. No usar reset destructivo al volver a la PC de casa: comparar primero sus modificaciones locales con esta rama.

## Datos trasladados y comprobaciones

El origen tenía dos actividades configuradas: Hockey sobre Patines Caballeros y Colonia. Son 3 usuarios, 13 eventos de permisos, 8 filas de padrón, 18 asistencias, 4 evaluaciones, 31 auditorías y 31 recibos. No había temporadas archivadas en ese origen; el cierre y la conservación de temporadas se probaron con datos ficticios. El ensayo anterior de 1500 deportistas permanece separado en `mp_private`; no se mezcló con los registros importados en `mc_private`.

Los SHA-256 de las tres unidades recibidas coincidieron con el manifiesto original y con la última exportación realizada con el origen cerrado para escritura. Se compararon padrón, asistencias, evaluaciones, sesiones, fichas, gestos, configuración, revisiones, recibos, auditoría, archivos, usuarios, permisos e identidades. Todos coincidieron. Los ID estables y el secreto de identidad se conservaron; este último nunca se incluye en código, navegador o Git.

Se restauró un respaldo completo en PostgreSQL/PGlite aislado. Además de comparar los registros, se ensayaron guardado y reintento usando el formato real de las autorizaciones importadas, sin modificar la base hospedada.

## Arquitectura y autorización

La web conserva Firebase Google login y el historial de pendientes. La API es una Edge Function en `https://kaalffshnrkxviqaymhv.supabase.co/functions/v1/muni360`. Verifica el token mediante PostgREST Third-Party Auth antes de establecer identidad. `verify_jwt=false` corresponde al gateway Edge; la validación criptográfica del JWT Firebase sigue siendo obligatoria en la función. No hay endpoint adicional de diagnóstico público.

Las operaciones de servicio y el estado sin redactar solo están disponibles para el rol de servidor. Tablas privadas con RLS y sin permisos directos de navegador. Los profesores cubren todos los equipos de sus actividades autorizadas. Se comprueban los permisos vigentes en cada solicitud y dentro del commit. Retirar acceso desde el panel de Muni360 rige en la próxima operación; no asumir que eliminar una cuenta en Firebase invalida inmediatamente un JWT ya emitido.

| Campo | Contrato |
| --- | --- |
| Usuario `version` | Identificador opaco de autorización; en el origen es UUID. Nunca convertir a entero. |
| Usuario `revision` | Entero para editar permisos con control de concurrencia. |
| Actividad `version` | Entero que identifica el estado que debe copiarse a Sheets. |
| Recurso `revision` | Entero por grupo, clase o evaluación. |
| Actividad `epoch` | Temporada; invalida cargas de otra temporada. |

Un guardado carga los documentos de su grupo y recurso; no lee la auditoría completa. Datos, revisión, recibo, autoría y cola de proyección se confirman atómicamente. Los conflictos de negocio son PT409. Las lecturas de la interfaz todavía incluyen el historial de la actividad: medir tamaño y tráfico antes de prometer rendimiento para toda una temporada.

## Continuidad, pendientes y mantenimiento

Los pendientes de Apps Script se conservan en su almacenamiento original y se copian una sola vez a la cola nueva, bloqueados y visibles para revisión. No se reenvían automáticamente. El endpoint viejo quedó con guardia de solo lectura en su versión 7. Existe una copia del código y un checkpoint inmutable de Apps Script, versión 8, anterior al último ajuste de mantenimiento.

Apps Script funciona como trabajador institucional: vistas de Sheets cada cinco minutos, lectura de CargaPadron, avisos de acceso al propietario y respaldos privados diarios en Drive. La credencial vive en Propiedades del script y solo su hash se guarda en la base. La credencial temporal de importación se cierra al activar la base; el mantenimiento utiliza su autorización institucional independiente. No requiere que una PC permanezca encendida.

Las vistas nuevas se crean privadas, con marca y actividad verificadas. No contienen DNI ni legajos privados. Se escriben valores literales, se comparan contra las celdas actuales y se procesan cambios en lotes acotados. Cada versión se confirma solo tras releer todas sus tablas. Una confirmación antigua no borra una versión pendiente más nueva. Los nombres de CargaPadron se refrescan aunque no haya cambios de asistencia.

Los respaldos incluyen usuarios, permisos, identidades, secreto de identidad, registros, fichas, revisiones, recibos, auditorías y temporadas. Se comprueba que la carpeta y el archivo de Drive sean privados y que el contenido leído tenga la misma huella. Los avisos de acceso reservan el envío antes de mandar mail; una respuesta ambigua queda para revisión, evitando reenvíos automáticos duplicados.

## Pruebas y límites de la evidencia

En la PC del club pasaron 26 pruebas nuevas y las 133 previas. Incluyen rollback de la transacción completa, idempotencia, conflictos, revocación de permisos, formatos de autorización reales, migración de pendientes, redacción de datos privados, copias grandes en lotes y recuperación de respaldos. Los recorridos de los dos portales con PostgreSQL/PGlite y Google simulado también se probaron; no equivalen a un login Google real en el portal migrado.

El piloto anterior verificó HTTP real con Google y un guardado concurrente del mismo registro: 1 éxito y 19 conflictos sin timeouts, además de copia automática real a Sheets. No afirmar que esto prueba 20 cuentas Google distintas o la carga completa de una temporada. El proyecto continúa en Free, sin habilitar facturación adicional; medir cuotas, tráfico y tiempos con el uso real.

## Recuperación

Conservar el origen congelado y los respaldos privados. Si ya existen cargas en Supabase, no reabrir el sistema viejo ni cambiar su configuración como reversión rápida: primero reconciliar los datos posteriores al corte. Para recuperación, restaurar en una base vacía, comparar el contenido y habilitar después. La activación se condiciona a copia del origen cerrada, respaldo verificado, permisos coincidentes y vistas sin pendientes.

## Control final del 12 de noviembre

`tools/verify-import.sql` compara de forma exacta las tres unidades con el último manifiesto del origen congelado, incluidos usuarios, permisos, identidades y cada colección de las actividades. Ejecutado con resultado `VERIFICACION_COMPLETA_OK`: 3 usuarios, 2 actividades y 31 recibos. No modifica registros ni banderas.

`tools/activate-verified.sql` repite ese control dentro de una transacción con bloqueos antes de habilitar la base y las actividades. No elimina la huella ni el vencimiento de la importación; el modo activo cierra ese ingreso. La ejecución y publicación fueron aprobadas explícitamente por el propietario y se completaron. Se conservaron las credenciales de importación; el modo `ready` impide utilizarlas para reimportar.

Se conservó una copia exacta del Hosting publicado en el canal `previo-supabase-20261112`. La versión nueva fue publicada desde la PC del club. Los recorridos de navegador de los dos portales y administración pasaron en esta PC; se agregó una espera de la carga asíncrona del historial para evitar una carrera en la prueba.

## Verificación posterior a la publicación

La configuración pública apunta a la Edge Function Supabase y las rutas `/muni360/`, `/muni360cyc/` y `/admin/` respondieron 200. La API rechaza sesiones ausentes e inválidas con HTTP 401 / SESION. La consulta privada confirmó 3 usuarios, 31 recibos, 2 actividades habilitadas, cero copias pendientes, versiones de Sheets actuales y origen congelado. El intento anónimo de inspeccionar por HTTP el endpoint antiguo recibió HTML de Google; no se consideró una verificación adicional de su respuesta MIGRADO.

La primera entrada real de Google al portal completo publicado queda para comprobar con la sesión del usuario. Los tests con Google simulado y el login real del piloto tienen alcances diferentes. Las nuevas vistas institucionales son:

- Hockey: https://docs.google.com/spreadsheets/d/16kf1nC5dS4LOd5eygWEly-qhB5Rq8_21L3oj30c9wjI/edit
- Colonia: https://docs.google.com/spreadsheets/d/1iRqT1FDNoZuu4Q1UMuCzFzEPZSkOhk4Ygk3XeImCu3Y/edit

Las planillas originales se conservan congeladas. Las cargas se guardan en Supabase; la proyección institucional a Sheets se procesa cada cinco minutos, sin necesitar una PC encendida.
