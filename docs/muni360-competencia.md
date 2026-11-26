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

La publicación del frontend se verifica después del push y se registra aquí su resultado.
