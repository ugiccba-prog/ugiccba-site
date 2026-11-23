# Colonia y COYFD: accesos independientes

- Colonia: `https://ugiccba.com.ar/muni360/colonia/`.
- COYFD: `https://ugiccba.com.ar/muni360/coyfd/`.

La entrada principal ofrece una tarjeta para cada programa. Cada acceso tiene su nombre y pantalla de ingreso propios y abre únicamente la actividad correspondiente. No tiene selector para mezclar ambos programas. Mis grupos, presentes diarios, Coordinación, Inteligencia y Cuestionarios reciben la actividad del portal abierto. Colonia conserva asistencia y comedor; COYFD conserva iniciación y orientación deportiva.

Se mantiene un único origen de código para las pantallas de base formativa. El empaquetado genera las dos páginas e incluye un alcance explícito (`MUNI_BASE_AREA`). Así las correcciones compartidas llegan a ambos programas sin duplicar archivos de mantenimiento. La elección de actividad anterior no prevalece sobre el acceso abierto, y el historial de COYFD tiene su propio identificador.

El perfil de Google y la verificación del servidor no cambian. Una cuenta autorizada para ambas actividades puede ingresar por cualquiera de los dos accesos; una cuenta sin autorización para el programa abierto recibe el aviso correspondiente. La restricción visual del portal no sustituye la autorización existente del servidor.

No se migran ni modifican padrones, asistencias, comidas, evaluaciones, legajos, permisos, colas pendientes o planillas. Los borradores siguen separados por cuenta y actividad. Las planillas de Colonia y COYFD ya son destinos independientes y conservan sus enlaces; los tres totales de comida continúan en Colonia.

Validación: siete pruebas específicas sobre páginas generadas, alcance de sesión, actividad recordada, permisos y navegación entre programas; suite general de 202 pruebas aprobada. El recorrido de navegador incluye los tres portales (Deportes, Colonia y COYFD) y el cambio entre accesos de Dirección, con recarga y alcance individual de los paneles. Las pruebas de integración utilizan Google simulado y una base aislada.
