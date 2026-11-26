# Competencia privada — 25 de noviembre de 2026

Ruta: https://ugiccba.com.ar/muni360/competencia/index.html. Acceso exclusivo del propietario verificado en cada petición; sin enlaces desde portales públicos. La URL sirve una pantalla de acceso; los datos requieren autenticación.

## Integración y mejoras

Fuentes canónicas en apps/muni360/source/competencia; empaquetado reproducible en muni360/competencia. Configuración del paquete compartida con el backend. Firebase usa MuniGoogle y el protocolo POST existente; no se agregan credenciales al cliente.

Convocados seleccionados del padrón activo por actividad, categoría y equipo, con identificadores reales. El endpoint devuelve exclusivamente identificador, nombre y grupo; no expone DNI ni legajos. El servidor vuelve a validar convocados y acciones, toma nombres del padrón y recalcula el puntaje.

Migración 018: tablas privadas con RLS y sin acceso directo; RPC exclusiva de service_role con control de propietario activo y modo de mantenimiento. Cabecera, convocados y eventos se escriben en una transacción. UUID estable y comparación de instantánea hacen idempotente la respuesta perdida; revisión y cierre impiden reemplazos posteriores.

Borrador local separado por cuenta, recuperación tras recargar, cambios de período y fair play persistidos, deshacer, historial con detalle de los últimos 50 registros, fecha ingresada en Argentina y presentación escapada con textContent. Modal accesible, foco y diseño móvil.

## Alcance

El catálogo conserva las acciones de los deportes aportados. Los marcadores muestran puntos registrados; en deportes por sets se incluye desglose por período. No son un motor de arbitraje, no calculan ganadores ni certifican reglamentos federativos. Modo post permite registrar el encuentro después de jugar con los mismos controles.

El borrador permite continuar una pantalla abierta sin red. No incluye instalación ni apertura inicial sin conexión ni envío automático en segundo plano; hay que reintentar Finalizar y Guardar. Un borrador por cuenta/dispositivo: no usar dos mesas simultáneas en el mismo navegador. Los registros finalizados se consultan sin edición. El guardado exige que los convocados sigan en el grupo activo.

## Verificación y despliegue

206 pruebas generales y 102 de backend aprobadas, incluidas seis nuevas de Competencia con PostgreSQL en memoria: permisos, privacidad, puntaje calculado, reintento sin duplicados, cierre y rollback atómico. Navegador aislado a 360 y 1440 px con datos ficticios: padrón, texto malicioso, marcador, recarga, recuperación, fallo y reintento. Paquete reproducible verificado.

Migración aplicada en kaalffshnrkxviqaymhv. Función muni360 versión 20 activa; módulos anteriores comparados con la versión publicada antes del despliegue. RLS y privilegios de las tres tablas/RPC comprobados en la base real. No se crearon partidos de prueba ni se alteraron padrones o permisos reales. Login Google y guardado con cuenta real quedan pendientes de aceptación del propietario.

Frontend c86c38f publicado en main y GitHub Pages: despliegue 45736887102 aprobado. HTTP 200 y coincidencia exacta de HTML, catálogo y manifest con el repositorio; llamada anónima a Competencia rechazada con 401. CI de paquete público aprobado para c86c38f. Backend remoto completo aprobado para 320789f (45736619424); las repeticiones de c86c38f seguían en curso al verificar la publicación. El último ajuste afecta únicamente el bloqueo de controles durante el guardado, verificado nuevamente en navegador. La copia de trabajo aislada está en scratch/competencia, rama feature/competencia-20261125; los cambios previos de la copia principal se conservaron.

## Datos ficticios para probar — 26/11/2026

Carga solicitada por el propietario en Hockey sobre Patines Caballeros: ocho jugadores llamados PRUEBA · Jugador 01 a 08, sin DNI ni legajos, en categoría PRUEBA COMPETENCIA y equipo Ficticio. Los padrones de ambas ramas de hockey sobre patines estaban vacíos al revisar. Se agregó únicamente ese grupo usando mc_commit, con auditoría, revisión de padrón y salida a Sheets; no se reemplazaron grupos existentes.

Historial: partido finalizado PRUEBA · Club Ficticio, resultado 3–1, ocho convocados, seis eventos (goles, falta y tarjeta azul) y fair play activo. ID aa261126-0001-4000-8000-000000000001. Guardado mediante mc_competencia en la misma transacción que el padrón.

Verificación real posterior: mc_service devuelve ocho jugadores en el grupo, cero DNI; la competencia tiene ocho convocados y seis eventos. No se registraron asistencias ni evaluaciones. La proyección a Sheets queda a cargo del puente habitual; no se confirmó su ejecución en esta carga.

Reproducción: server/supabase/tools/seed-competencia-prueba.sql. El script tiene identificadores estables y guardas para no duplicar ni reemplazar datos. Para probar un partido nuevo, elegir Hockey sobre Patines → Caballeros → PRUEBA COMPETENCIA / Ficticio; para consultar el ejemplo, usar Ver últimas competencias.
