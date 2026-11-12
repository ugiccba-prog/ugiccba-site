# Muni360: migración completa a Supabase

Estado: infraestructura y código preparados, importación del origen pendiente. NO se cambió el portal activo. Rama `migracion/supabase-completa-20261111`.

## Arquitectura

La web mantiene Firebase Google login y la cola local. Una Edge Function verifica cada JWT mediante PostgREST Third-Party Auth; no confía en decodificar claims. Las tablas privadas, los commits y los estados sin redactar se acceden exclusivamente desde el servicio. Las políticas y capacidades se vuelven a comprobar en cada operación; el SQL comprueba permisos vigentes dentro del commit.

Registros separados por grupo/clase/evaluación; un guardado de asistencia carga el grupo y la clase correspondientes, sin recorrer todo el historial o la auditoría. El commit compara documentos para evitar sobrescrituras, valida versión, padrón y temporada y guarda datos, autoría, recibo y trabajo de Sheets atómicamente. Los conflictos de negocio son PT409, nunca 40001. Los recibos se verifican antes de repetir una escritura. Dos actividades no comparten bloqueo; dentro de una actividad el bloqueo dura solo el commit SQL, sin esperar redes externas.

El frontend usa un espacio de pendientes separado para Supabase: nunca reenvía silenciosamente una cola vieja de Apps Script a la base nueva. Antes de cualquier corte hay que resolver las cargas pendientes del sistema viejo en sus dispositivos.

## Preparación e importación

- Migración aplicada: `20261111235236_full_muni360_core`, esquema `mc_private` separado de `mp_private`.
- Proyecto Free existente `kaalffshnrkxviqaymhv`, sin facturación adicional.
- API desplegada: `https://kaalffshnrkxviqaymhv.supabase.co/functions/v1/muni360`.
- `verify_jwt=false` en el gateway Edge porque usa JWT Firebase: la función exige un token y lo verifica mediante `mc_identity` en PostgREST antes de establecer identidad o hacer llamadas de servicio. No es un endpoint anónimo de datos.
- La configuración inicial está en modo `preparing`, actividades deshabilitadas, sin usuarios importados. No habilitar `ready` hasta completar y comparar la importación.

`tools/ExportarDesdeSheets.gs` se añade al proyecto Apps Script ORIGINAL sin publicar otra versión web. Requiere una credencial aleatoria `mci_` de 256 bits en la propiedad `UGI_SUPABASE_IMPORT_KEY`; solo su SHA-256 queda en Supabase, con vencimiento de 24 horas. No incluirla en código, Git, capturas ni logs.

Ejecutar `exportarMuni360ASupabase` desde el editor con la cuenta propietaria. Obtiene un bloqueo del origen durante la exportación, valida el hash del estado original y manda fragmentos a un destino fijo. Conserva usuarios, permisos, identidades, ID_SECRET privado, estados, revisiones, recibos, autorías y archivos de temporada. Los logs contienen solo nombres de actividades, número de partes y SHA-256; no datos personales o claves. No modifica las tablas originales.

Una vez recibidas las 26 unidades, verificar que todas las partes están completas y finalizar por servicio cada unidad contra el hash del manifiesto. Empezar por `global`. Comparar cantidades y hash canónico de estado, auditoría, recibos, versiones, archivos y permisos. La clave de exportación no puede finalizar ni habilitar la migración. Cerrar/revocar esa clave al terminar. No eliminar inmediatamente el origen.

## Sheets

`tools/SheetsCompleto.gs` se añade al puente autorizado, que ya tiene la credencial de copia en Propiedades. El activador existente del piloto invoca también el copiador completo; no necesita otro consentimiento ni un endpoint web de Apps Script. Las vistas nuevas se crean privadas, con una marca exclusiva por actividad; no escriben sobre los Sheets originales.

Replica padrón sin DNI, asistencia, evaluaciones, gestos, DUA, cambios con horario argentino e históricos. Legajos, DNI e ID_SECRET no se exponen al copiador de vistas. Solo confirma una versión tras releer todas sus tablas. Una confirmación antigua no borra un trabajo de versión más nueva. Un error de Sheets no invalida la carga confirmada en Supabase. Las vistas son reemplazos idempotentes, sin duplicar filas ante una respuesta perdida. La clave actual de copia es temporal: vence el 18/11/2026 a las 20:00 ART.

## Validación y condiciones antes del corte

12 escenarios PostgreSQL/PGlite y 4 pruebas de exportador/copias aprobados inicialmente; repetir después de cambios. Incluyen ID estables, permisos, suspensión, conflictos, pérdida de respuesta, duplicados, estado/recibo/auditoría/cola atómicos, rollback por fallo, redacción de DNI/legajos, temporadas y Unicode entre partes. No confundir estos escenarios con 20 cuentas reales de Google.

El piloto previo sí verificó HTTP real con Google, 1 éxito + 19 conflictos del mismo registro y copia automática real a Sheets. El API completo, la importación real y el portal completo requieren su propia comprobación; no heredan automáticamente esas garantías.

Antes de cambiar el portal activo quedan obligatorios: comparar exportación/importación; verificar las tres vistas con usuarios reales; comprobar la entrega completa de las nuevas vistas; respaldos y ensayo de recuperación de la nueva base; avisos de acceso de nuevos usuarios; lectura actualizada de CargaPadron; revisar grandes historiales y límites del copiador (actualmente 1,8 MB por vista/operación); prueba de dos cuentas en distintos grupos; comprobar que no haya pendientes antiguos; documentar corte y reversión. La infraestructura preparada NO equivale a migración terminada.

## Evidencia de esta preparación

- 16 pruebas nuevas aprobadas (12 escenarios SQL + 4 de exportación/copias), y las 133 pruebas previas sin regresiones.
- Chrome aislado: recorrido completo de Deportes y Colonia contra el núcleo nuevo con PostgreSQL/PGlite y Google simulado. Guardado automático, DUA sin legajo privado, nota 6,5, desconexión/reconexión, doble clic y panel de propietario aprobados. Esto no mide latencia real ni valida firmas Google.
- Revisión de interfaz: 12 combinaciones de portal, perfil y ancho (360, 390 y 1440), sin desbordes ni errores JavaScript.
- Edge Function hospedada: HTTP 401/SESION ante ausencia de token o token falso; HTTP 403 ante un origen externo no habilitado.
- Preview completo de siete días, separado del portal activo: https://muni360-ugi-ensayo--supabase-migracion-mleyxrv3.web.app/muni360/ (Colonia en `/muni360cyc/`, administración en `/admin/`). Hasta importar el origen el acceso muestra migración en curso.
- El exportador está cargado en el editor original, sin publicar otra versión web: https://script.google.com/d/11B4Nfn84rYQU51pSzz0W1L9U3Z7XStXFH69Gt9obNZO-eFgY8Z5CFkZP/edit
- El puente autorizado ya tiene `SheetsCompleto.js` y su activador existente invoca las vistas completas. No hay datos reales importados todavía. La próxima acción necesaria es configurar la propiedad privada `UGI_SUPABASE_IMPORT_KEY` en el origen y ejecutar `exportarMuni360ASupabase` desde la cuenta propietaria.
