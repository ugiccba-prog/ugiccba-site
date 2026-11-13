# Muni360: decisión vigente — Supabase, Firebase Auth y Google Sheets, costo cero

Actualización: 12 de noviembre de 2026. Esta decisión registra el corte aprobado desde `apps-script-3.0.0` hacia **Supabase (`supabase-1.0.0`)** manteniendo presupuesto cero.

El sistema publicado utiliza **Firebase Authentication (Spark)** para identificar a cada persona con Google, **Supabase (Edge Function `muni360` + PostgreSQL con RLS en plan Free)** como API y almacenamiento privado principal, y **Apps Script + Google Sheets/Drive** como trabajador institucional. No requiere Cloud Run, Firestore, tarjetas ni habilitar facturación. La publicación principal del ensayo corre en GitHub Pages bajo [`https://ugiccba.com.ar/ensayo360muni/`](https://ugiccba.com.ar/ensayo360muni/).

Los originales, usuarios, revisiones, recibos de operaciones, legajos y auditorías viven en tablas privadas de PostgreSQL sin acceso directo desde el navegador. Un guardado se confirma atómicamente en una transacción (datos, revisión, recibo, autoría y cola de proyección), validando el token de Firebase y los permisos vigentes en cada solicitud. Las planillas de cada actividad en Google Sheets son vistas de consulta sin DNI, legajos privados ni notas de sesiones, actualizadas cada 5 minutos por el trabajador de Apps Script (o manualmente desde Dirección con `Actualizar vistas de Sheets`).

Dirección propietaria aprueba usuarios. Los profes cubren todos los equipos dentro de las actividades habilitadas. Los reemplazos vencen en la fecha elegida. Suspender o modificar permisos rige inmediatamente en la próxima operación del servidor y genera un aviso al correo del usuario cuando se aprueba o reactiva un acceso.

La edición operativa se hace desde la app. Sheets mantiene su utilidad para consultar, filtrar, preparar reportes y cargar nombres mediante `CargaPadron`. Las pestañas operativas de las vistas sincronizadas no deben editarse a mano; las fórmulas y notas propias van en otras pestañas, que la sincronización conserva. El trabajador institucional realiza además respaldos diarios privados en Google Drive.

El plan gratuito impone límites de ejecución, transferencia, base y cuota diaria de Google. No se propone facturación automática para superarlos: los errores y las cargas sin conexión quedan en la cola recuperable por cuenta y nunca se muestran como guardados confirmados. El uso real posterior al corte debe medirse durante la validación funcional en cancha.

El servidor Node/Firestore anterior (`server/muni360/`) y los candidatos previos de Apps Script (`archive/apps-script-v2/`) quedan archivados sin activar. Los módulos puros `domain.cjs` y `policy.cjs` se conservan como fuente de verificación para las pruebas locales de reglas de negocio (`npm run test:muni360`).

Estado: migración a Supabase verificada y publicación activa en `https://ugiccba.com.ar/ensayo360muni/`. Pendiente de completar la validación funcional real con cuentas Google sobre la matriz de aceptación antes de habilitar datos definitivos del club.

> **Trazabilidad histórica (10–11/11/2026):** La etapa previa ejecutó un piloto con `apps-script-3.0.0` como backend HTTP directo en Apps Script. Tras verificar la exportación final e importación exacta (`VERIFICACION_COMPLETA_OK`), se realizó el corte oficial a `supabase-1.0.0` el 12/11/2026.

Ver [arquitectura y estado en Supabase](../server/supabase/README.md), [publicación en dominio UGI](muni360-dominio.md), [guía de uso](muni360-guia-uso.md) y [matriz de aceptación](muni360-pruebas-aceptacion.md).
