# Muni360: decisión vigente — Apps Script y Sheets, costo cero

Actualización: 10 de noviembre de 2026. Esta decisión reemplaza la propuesta de Cloud Run/Firestore del paquete anterior.

El sistema preparado utiliza Google para identificar a cada persona (Firebase Authentication en Spark), Apps Script como backend y Google Sheets como almacenamiento. No requiere Cloud Run, Firestore, cuentas de servicio, tarjetas ni habilitar facturación. El sitio estático puede seguir en GitHub Pages.

Los originales, usuarios, revisiones, recibos de operaciones y auditorías viven en una planilla privada de Dirección. Un cambio se escribe mediante un único `spreadsheets.batchUpdate`: la operación se aplica completa o falla completa. Las planillas de cada actividad son vistas de consulta sin DNI, legajos privados ni notas de sesiones. La app distingue el guardado del original de la actualización de esas vistas.

Dirección propietaria aprueba usuarios. Los profes cubren todos los equipos dentro de las actividades habilitadas. Los reemplazos vencen en la fecha elegida. Suspender a alguien modifica el permiso que se consulta en cada solicitud; no depende de esperar a que expire una sesión del navegador.

La edición operativa se hace desde la app. Sheets mantiene su utilidad para consultar, filtrar, preparar reportes y cargar nombres mediante `CargaPadron`. Las tablas originales y las vistas sincronizadas no deben editarse a mano. Las fórmulas y notas propias van en otras pestañas, que la sincronización conserva.

El presupuesto cero impone límites de tiempo de ejecución, llamadas a Google, celdas y almacenamiento. No se propone facturación automática para superarlos. El tamaño de una operación se limita y los errores no se presentan como un guardado confirmado. El uso real debe medirse en el piloto.

El servidor Node/Firestore anterior queda como alternativa técnica archivada, sin activar. Sus pruebas siguen como regresiones históricas. Los módulos puros `domain.cjs` y `policy.cjs` son también la fuente del archivo generado `Muni360Domain.gs`; no exigen instalar ese servidor.

Estado: código candidato y pruebas locales; falta configuración y ensayo real en Google. No es todavía una versión aprobada para producción.

Ver [guía paso a paso](muni360-operacion.md), [revisión y pendientes](muni360-revision.md) y [matriz de aceptación](muni360-pruebas-aceptacion.md).
