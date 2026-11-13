# Paneles de Dirección y Coordinación

La cuenta propietaria es la única que ve controles de sincronización, usuarios y permisos y el panel global del club. El rol Dirección UGI está reservado al propietario; un nombre de rol nunca concede acceso global por sí solo.

Coordinación ve su panel con las actividades que Dirección le asignó. Puede consultar todas juntas o seleccionar algunas. Los perfiles operativos tienen acceso a sus actividades autorizadas y todos los equipos de ellas. El selector sólo ofrece actividades habilitadas para la cuenta. Dirección amplía o reduce ese alcance en Usuarios y permisos.

El panel se abre desde la tarjeta superior; no hace consultas agregadas mientras está cerrado. Ofrece períodos de 30, 90 y 365 días o historial completo, inscripciones actuales, grupos, asistencia P/T/A, evaluaciones, promedio de notas, observaciones amarillas/rojas y evolución mensual. Los datos futuros quedan fuera del período. No deduce asistencia faltante, abandono ni personas únicas del club: una inscripción por actividad puede corresponder a una misma persona en varios deportes.

`/api/dashboard` vuelve a verificar autorización en servidor y sólo devuelve agregados, sin nombres, DNI, fichas privadas ni registros personales. Las lecturas se procesan con un máximo de tres solicitudes simultáneas. Los controles del sistema requieren la identidad propietaria aun cuando se intente llamar la API directamente.

Fuentes: `assets/scripts/muni360-dashboard.js`, `server/supabase/functions/muni360/dashboard.mjs`, política y manejador de la misma carpeta. Regenerar el paquete público con `npm run build:ensayo360` antes de publicar. La sincronización y los datos de actividades continúan en el mismo proyecto existente.
