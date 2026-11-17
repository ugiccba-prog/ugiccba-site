# Portal visual de Deportes, Colonia y COYFD · 17/11/2026

Las interfaces de Deportes, Colonia y COYFD conservan Firebase Google login, autorización del servidor y `Muni360Sync.Client`. No modifica el esquema de datos ni agrega credenciales o permisos.

## Funciones

- Inicio con indicadores y evolución calculados desde los registros de la actividad y el grupo elegidos, hasta la fecha seleccionada. Períodos de 30/90/365 días o todo el historial.
- Equipos con padrón real y accesos a evaluar o comparar cada deportista.
- Asistencia P/A/T y semáforo independientes, inicialmente sin seleccionar. Pulsar nuevamente una selección la deja sin marcar. Las áreas táctiles miden al menos 44 píxeles.
- Guardado manual y automático sólo cuando todo el grupo tiene las dos marcas. Los borradores incompletos se conservan por cuenta y actividad; nunca se anuncian como confirmados.
- El guardado conserva clima y puntos. Una repetición idéntica no vuelve a enviar la misma lista. Al consultar datos nuevos se reinicia esta protección para permitir una corrección posterior.
- Evaluaciones mediante el formulario y las rúbricas vigentes. Los cambios sin enviar se recuperan por cuenta, actividad, grupo, fecha y jugador. El guardado distingue confirmación, cola pendiente y error.
- Comparación de dos jugadores distintos del mismo grupo: asistencia, tardanzas, ausencias, semáforo, promedios y cantidad de muestras por dimensión. Radar y evolución como detalle opcional; referencia de equipo calculada por jugador con notas válidas. Las dimensiones faltantes no se convierten en cero y no se inventan ventajas.
- Seguimiento muestra observaciones del período y apoyos DUA devueltos por los permisos actuales. No consulta el legajo para armar la vista.
- Planificador, banco metodológico, reconocimientos, padrón, auditoría, archivos de temporada y herramientas institucionales conservan sus operaciones existentes.
- Agenda deriva los horarios del catálogo canónico de Comunidad en cada compilación. Los deportes sin horario muestran un estado vacío.
- Avisos consulta `/api/comunidad/feed`, filtra actividad, categoría y equipo, y permite abrir el módulo completo de Comunidad con publicación y suscripciones según los permisos existentes. La nueva vista no envía mensajes por sí sola.

## Archivos y compilación

Las fuentes son `apps/muni360/source/deportes/index.html` y `apps/muni360/source/colonia/index.html`. `muni360-portal.js` contiene los cálculos base y el comparador; `muni360-ui.js` agrega las vistas, gráficos y utilidades de presentación. `muni360-portal.css` contiene el diseño del portal. No utiliza los datos constantes del prototipo aportado.

`npm run build:muni360-public` genera `/muni360/`, incluyendo Comunidad y el catálogo derivado de `comunidad/catalogo.js`. `npm run check:muni360-public` verifica recursos y hashes. No editar el paquete generado a mano.

Desde `f3dcdcd`, Colonia y COYFD también usan el portal visual completo y sus funciones adaptadas a grupos. Administración conserva su interfaz. El comparador, el seguimiento, la agenda y los avisos están disponibles en ambos portales operativos.

## Verificación realizada

- 149 pruebas de aplicación y 60 pruebas del servicio de datos pasaron sobre una copia de trabajo aislada.
- Se verificó la construcción reproducible del paquete público.
- En navegador se probaron selección de grupo, asistencia P/T y semáforo, confirmación en PostgreSQL local, evaluación decimal, recuperación del borrador después de recargar, comparación y sus filtros, cartelera de Comunidad y apoyo DUA sin legajo privado.
- Se comprobó el perfil Consulta con todos los controles de escritura deshabilitados, ausencia de desbordamiento horizontal y áreas táctiles de 44 píxeles en un ancho de 390 píxeles.
- Las pruebas usan cuentas y registros ficticios con Google simulado y PostgreSQL/PGlite local. No equivalen a un nuevo login institucional ni a una escritura en producción. No se alteraron registros ni permisos de la base hospedada.

## Publicación

El código está integrado en `main` del repositorio UGI y se publica mediante GitHub Pages en la dirección habitual. Para continuar desde cualquiera de las computadoras, seguir `docs/muni360-continuidad.md`. No se creó un sitio alternativo ni se cambiaron DNS, usuarios o claves.
