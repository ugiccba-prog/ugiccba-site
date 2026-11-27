# Muni360 oficial: destino publicado y compilación

Ruta oficial publicada en `main`: https://ugiccba.com.ar/muni360/.

- Deportes: `/muni360/deportes/`
- Colonia: `/muni360/colonia/`
- COYFD: `/muni360/coyfd/`
- Usuarios y permisos: `/muni360/admin/`
- Competencia privada: `/muni360/competencia/`
- Cuestionarios: `/muni360/encuesta/`
- Avisos de cambios de partido y entrenamiento: `/comunidad/`

El paquete `/muni360/` se sirve desde la rama `main` publicada en GitHub Pages, integrado con Firebase Authentication (ingreso con Google) y Supabase (`supabase-1.0.0`) para los datos operativos, planillas espejadas en Google Drive (`docs/muni360-planillas.md`) y avisos de Comunidad. No se modifican DNS ni CNAME.

## Código y publicación

Abrir `UGI.code-workspace` en VS Code. Fuentes: `apps/muni360/source/deportes/`, `apps/muni360/source/colonia/`, `apps/muni360/source/admin/`, `assets/scripts/muni360-*.js`, `assets/styles/muni360-cancha.css`. Entrada común: `apps/muni360/entrada.html`. Backend y mantenimiento: `server/supabase/`; SQL histórico: `pilots/supabase/supabase/migrations/`.

`muni360/` es el paquete generado: no editarlo a mano. Ejecutar `npm run build:muni360-public` tras cambios en las fuentes; `npm run check:muni360-public` comprueba que el paquete corresponda al código actual. Solo incluye recursos públicos enumerados y sus huellas. Nunca copiar carpetas privadas, credenciales, respaldos, node_modules o código del servidor al paquete.

La configuración Firebase de navegador es pública por diseño. Las claves privadas y de servicio nunca forman parte de este repositorio. Los recursos JS/CSS del paquete llevan versión de contenido para evitar mezclar una página nueva con scripts cacheados de otra versión.

## Continuar desde ambas PC

Referencia actualizada el 17/11/2026: trabajar desde `main` de `ugiccba-prog/ugiccba-site`. Copia de casa: `C:\Users\Juan\Repositorios\ugi`. Copia del club: `C:\Users\Juan Machado\Repo\ugiccba-site`. Las rutas de preparación 2027 y de migración que figuraban antes corresponden a etapas anteriores; no reemplazan estas copias vigentes.

Consultar `docs/muni360-continuidad.md` antes de retomar. Revisar cambios locales, sincronizar sin forzar ni borrar archivos, y ejecutar `npm run test:muni360` y `npm run check:muni360-public`. Las pruebas con Google simulado no sustituyen un ingreso institucional real.

## Sesiones y cargas pendientes

Desde el 27/11/2026, la antigua copia en Firebase Hosting y las vistas previas de Portada Comunidad y Estadísticas de Competencia redirigen al portal oficial. Firebase Authentication conserva sus rutas reservadas para el ingreso con Google. Las cargas confirmadas siguen en Supabase. Las cargas locales pendientes están ligadas al navegador y al dominio donde se crearon. No se trasladan automáticamente.

El usuario debe iniciar sesión una vez en el dominio nuevo; luego rige “Mantener sesión iniciada”. La persistencia depende del mismo navegador y de que no borre sus datos. Revocar permisos sigue bloqueando nuevas operaciones en el servidor. No se modifican datos, usuarios o permisos por cambiar la dirección.

## Recuperación

Un fallo de publicación se corrige revirtiendo el commit de interfaz en `main` y verificando el nuevo despliegue. No reabrir el backend Apps Script antiguo ni restaurar la base anterior: los guardados actuales continúan en Supabase. Conservar respaldos privados y reconciliar cualquier cambio antes de una restauración de datos.

## Publicacion verificada el 12/11/2026

La copia de publicacion del club quedo en la rama main, siguiendo origin/main. Se conservo la rama publicacion/ensayo360muni-20261112 como referencia del cambio. Los otros dos worktrees no fueron modificados. Se agrego main a las ramas que git fetch actualiza automaticamente, conservando la configuracion previa.

GitHub Pages publico correctamente la nueva ruta. Se compararon las huellas de los 14 recursos del manifiesto servido por HTTPS y el contenido de la portada institucional; coincidieron. La entrada se inspecciono a 390 y 1440 pixeles, sin desbordes. En los tres portales se inicializo el SDK real de Firebase y se mostro la opcion de recordar sesion; desde el nuevo origen, la API rechazo correctamente solicitudes sin token con HTTP 401 / SESION, confirmando tambien CORS. No se accedio a una sesion Google personal para estas pruebas.

Validacion previa: 133 pruebas generales y 35 de Supabase; recorridos del paquete generado con PGlite y Google simulado (21 llamadas), guardado, evaluacion decimal, recuperacion sin conexion, permisos y ausencia de duplicados. La comprobacion del paquete tambien paso en GitHub Actions/Linux. El 12/11/2026 por la noche, el propietario confirmo el primer ingreso real con su cuenta Google sobre `https://ugiccba.com.ar/ensayo360muni/` recorriendo Deportes (`/deportes/`), Administracion (`/admin/`) y Colonia (`/colonia/`) con sesion recordada, guardado en Supabase, vistas a Sheets (`S01`), legajo/DUA (`D01`/`D02`) y bloqueo al intentar modificar la cuenta propietaria (`G05`). La continuacion de la matriz operativa queda registrada en `docs/muni360-pruebas-aceptacion.md`.
