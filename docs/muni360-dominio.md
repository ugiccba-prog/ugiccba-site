# Muni360 en el dominio de UGI

Entrada: https://ugiccba.com.ar/ensayo360muni/

- Deportes: `/ensayo360muni/deportes/`
- Colonia / COYFD: `/ensayo360muni/colonia/`
- Permisos: `/ensayo360muni/admin/`

GitHub Pages continúa publicando `main` desde la raíz. No se modifican DNS, CNAME ni la portada institucional. Firebase y Supabase siguen en sus proyectos existentes y gratuitos. El login Google admite ugiccba.com.ar y www.ugiccba.com.ar; la API conserva su validación de tokens y permisos vigentes.

## Código y publicación

Abrir `UGI.code-workspace` en VS Code. Fuentes: `muni360/` (Deportes), `muni360cyc/` (Colonia), `admin/`, `assets/scripts/muni360-*.js`, `assets/styles/muni360-cancha.css`. Entrada común: `apps/muni360/entrada.html`. Backend y mantenimiento: `server/supabase/`; SQL histórico: `pilots/supabase/supabase/migrations/`. Los proyectos anteriores se conservan documentados, sin activarlos nuevamente.

`ensayo360muni/` es un paquete generado: no editar allí a mano. Ejecutar `npm run build:ensayo360` tras cambios en las fuentes; `npm run check:ensayo360` comprueba que el paquete corresponda al código actual. Solo incluye recursos públicos enumerados y sus huellas. Nunca copiar carpetas privadas, credenciales, respaldos, node_modules o código del servidor al paquete.

La configuración Firebase de navegador es pública por diseño. Las claves privadas y de servicio nunca forman parte de este repositorio. Los recursos JS/CSS del paquete llevan versión de contenido para evitar mezclar una página nueva con scripts cacheados de otra versión.

## Continuar desde ambas PC

La copia de publicación de la PC del club es `C:\Users\Juan Machado\Projects\ugiccba-site-publicacion`. Se conservan `ugiccba-site` y `muni360-supabase-migracion`. Al volver a casa: primero `git status`, revisar/guardar los cambios locales y hacer `git fetch origin`. No usar `reset --hard` ni `clean` para actualizar. Si hay cambios sin resolver, crear otro worktree basado en `origin/main` para continuar, sin sobrescribir la copia anterior. Abrir el workspace de esa copia.

Verificación habitual: `npm run test:muni360`, `npm run check:ensayo360`, y pruebas de `server/supabase/tests/` con PGlite del lockfile de `pilots/supabase`. Las comprobaciones automáticas de interfaz con Google simulado no sustituyen la primera entrada real del usuario desde el dominio nuevo.

## Sesiones y cargas pendientes

El acceso anterior de Firebase permanece publicado. No redirigirlo automáticamente ni borrar su almacenamiento. Una carga que diga “Guardado en la base” está en Supabase y se ve desde cualquiera de las dos direcciones. Una carga local pendiente debe enviarse desde el dispositivo, navegador y dominio donde fue creada. Ingresar allí con la misma cuenta y conexión antes de cambiar. No copiar tokens o cargas pendientes entre dominios automáticamente.

El usuario debe iniciar sesión una vez en el dominio nuevo; luego rige “Mantener sesión iniciada”. La persistencia depende del mismo navegador y de que no borre sus datos. Revocar permisos sigue bloqueando nuevas operaciones en el servidor. No se modifican datos, usuarios o permisos por cambiar la dirección.

## Recuperación

Un fallo de publicación se corrige revirtiendo el commit de interfaz o volviendo al acceso Firebase. No reabrir el backend Apps Script antiguo ni restaurar la base anterior: los guardados actuales continúan en Supabase. Conservar respaldos privados y reconciliar cualquier cambio antes de una restauración de datos.
