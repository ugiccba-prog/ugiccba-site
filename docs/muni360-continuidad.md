# Muni360 · Continuidad vigente al 26/11/2026

Esta sección es la referencia actual para continuar. Las notas históricas de abajo documentan etapas anteriores y no indican la rama, el backend ni las carpetas que deben usarse hoy.

## Repositorio y computadoras

- Repositorio: https://github.com/ugiccba-prog/ugiccba-site · rama oficial: `main`.
- PC de casa, DESKTOP-G6MFIIR: `C:\Users\Juan\Repositorios\ugi`.
- PC del club, Juan-M: `C:\Users\Juan Machado\Repo\ugiccba-site`.
- Últimos cambios funcionales consolidados el 26/11/2026: acceso unificado exclusivo para `ugiccba@gmail.com` en los portales, mejoras de la revisión del 24/11 aplicadas en Supabase y [Competencia privada](muni360-competencia.md).
- No retomar una copia antigua de ensayo, una rama anterior o un ZIP como base sin compararlos con `origin/main`. Revisar `git status` antes de sincronizar; conservar cambios locales y actualizar sin forzar ni borrar archivos.

## Cambios recientes incorporados (17/11 al 24/11/2026)

- `c998fa6` / `0f47ac3` / `f3dcdcd`: Portal visual completo en Deportes y Colonia/COYFD, comparador con radar de 3 a 16 dimensiones, seguimiento, agenda y service worker de Comunidad.
- `514de5d`: Optimización de carga SQL (`013_fast_load_and_dashboard.sql` con `jsonb_agg`) y consulta paginada por lotes de a 2 actividades en `/api/dashboard`.
- `076ea77` / `131acea`: **Módulo de Inteligencia e IA** (`014_inteligencia.sql`, `inteligencia.mjs`, `muni360-inteligencia.js`) con alertas determinísticas (`CAIDA_ASISTENCIA`, `AUSENCIAS_CONSECUTIVAS`, `SEMAFORO_ALERTA`), vista de alertas activas, registro de intervenciones, escalamiento a 48 h y resumen asistido por IA.
- `832401d` / `2c776e2` / `cd5ed25` / `d06a0a2` / `d0ae801`: **Cuestionarios anónimos** (`015_surveys.sql`, `surveys.mjs`, `muni360-surveys.js`, `/muni360/encuesta/`) en el menú principal, envío público sin token, integración con alertas de Inteligencia, desplegables dinámicos en cascada por deporte y creación por lote para múltiples equipos.
- `4838e07`: Reorganización de planillas deportivas en Google Sheets e integración de Cuestionarios e Inteligencia en las vistas y exportaciones XLSX.
- `bf1b567` / `8e01ff2` / `81c1de8`: Corrección de viewport y push en Comunidad, **Modo Demo completo (`muni360-demo-runtime.js`)** para Panel, Inteligencia, IA y Cuestionarios, y telemetría de producción/simulación de tráfico en Supabase.
- `0b904fd`: **Importación de padrones de Excel por equipo/tira y revisión de borradores:** soporte de columnas `Categoría` y `Tira`/`Equipo` en Excel (`muni360-import.js`), vista previa agrupada por tira A/B y envío en un único lote atómico (`ALTA_PADRON_LOTE` en `domain.mjs` / `core.mjs`).
- `1d4186e`: Navegación del navegador (Atrás/Adelante con `history.pushState`/`popstate`) entre secciones internas sin cerrar la sesión activa.
- `dbacdba`: Priorización de actualización de Google Sheets y procesamiento de cola acotada (`server/supabase/tools/worker-jobs-priority.sql`).
- `e972f0b` / `268d214` / `76d44c2`: **Presentes diarios de Colonia y COYFD sin duplicados** (`muni360-presence.js`, `presence.mjs`, `docs/muni360-presentes-diarios.md`), compactados en un panel desplegable por fecha para Dirección UGI y Coordinación.
- `458c638`: **Planillas horizontales de asistencia por grupo y tira en Google Sheets** (`AsistenciaHorizontal.gs`, `SheetsInstitucional.gs`, `docs/muni360-asistencia-horizontal.md`) con pestañas `Asist · <grupo> · <tira>` y tres totales diarios en Colonia (Presentes, Comedor y Vianda).
- `a342db1` / `7e804e0`: **Separación de accesos y pantallas de Colonia y COYFD** (`/muni360/colonia/` y `/muni360/coyfd/`, `docs/muni360-portales-separados.md`), generados desde la misma fuente con `MUNI_BASE_AREA`, tarjetas independientes en `entrada.html` y aislamiento de sesión, paneles e historial.

- `768c2ba` / `e2194c8`: Comedor y Vianda en Colonia, código de planillas horizontales y exportación. La vista de auditoría muestra los campos que cambiaron y las jornadas parciales se señalan en el resumen.
- `30d9057`: Dirección puede dar de alta por correo, asignar permisos antes del primer ingreso y enviar un aviso mediante la cola institucional. Se comprobó publicación en GitHub Pages y la cola con datos de prueba. La entrega a una casilla real sigue pendiente de verificación. Ver [Avisos de acceso](MUNI360_AVISOS_ACCESO.md).

- **Archivo de accesos:** Dirección puede retirar de la lista principal los accesos pendientes, suspendidos o vencidos. El filtro **Archivados** permite restaurarlos como suspendidos. **Historial de permisos** conserva las dos operaciones.
- **Revisión integral y mejoras (24/11/2026):** Corrección de cola offline por actividad en `Muni360Sync` (`reviewAndRetry`/`discardFirst`), paginación ampliada a 200 usuarios en `/api/users/list` con precarga multipágina en `muni360-admin.js`, validación en servidor y tope de 500 respuestas en cuestionarios públicos (`015_surveys.sql`), orden de pestañas vacías en Sheets (`SheetsInstitucional.gs`) y ajuste ES11 en `.jshintrc`. Ver [Guía de despliegue en Supabase y Google Sheets](muni360-despliegue-supabase-sheets.md).
- **Consolidación en `main` (26/11/2026):** Integración de `origin/main` (rediseño visual/móvil y [Competencia privada](muni360-competencia.md)) con las mejoras locales, más acceso unificado en todos los portales exclusivamente para `ugiccba@gmail.com` (sin cambios para el resto de las cuentas) y despliegue en Supabase (`kaalffshnrkxviqaymhv`).

## Registro de cambios

En cada cambio de Muni360, actualizar el [Registro de cambios de Muni360 de UGI CCBA](https://chatgpt.com/library?file_id=libfile_ce838a31121c81918f39f93f40e8844c&account_id=personal) y la documentación técnica que corresponda. Asentar fecha, alcance, estado de publicación y verificaciones. Después de publicar, registrar el resultado y las verificaciones que queden pendientes. Para cambios de permisos, conservar la auditoría con quién hizo el cambio, cuándo, sobre qué acceso y qué valores cambiaron.

## Código y operación actuales

- Página oficial: https://ugiccba.com.ar/muni360/ · Deportes: `/muni360/deportes/` · Colonia: `/muni360/colonia/` · COYFD: `/muni360/coyfd/` · administración: `/muni360/admin/` · cuestionarios: `/muni360/encuesta/` · competencia privada: `/muni360/competencia/` · avisos: `/comunidad/`.
- Fuentes canónicas: `apps/muni360/source/` (`deportes/`, `colonia/`, `admin/`, `encuesta/`, `competencia/`), `apps/muni360/entrada.html`, `assets/scripts/muni360-*.js` y estilos `assets/styles/muni360-cancha.css` / `muni360-portal.css` / `muni360-theme.css`.
- `muni360/` es generado (**36 archivos públicos**, 35 en `muni360/manifest.json`, incluyendo `/muni360/competencia/`): construir con `npm run build:muni360-public`; no editar sus archivos como fuente.
- Los portales usan el acceso vigente de Google/Firebase y el backend Supabase (`kaalffshnrkxviqaymhv`). El mantenimiento institucional de Sheets y respaldos sigue separado en `Projects/Muni360-Privado/apps-script-institucional`.
- Mantener los estados **P = Presente, A = Ausente, T = Tarde**; no sustituir Tarde por Justificado.
- Los permisos de cada cuenta vienen del servidor. Las demos usan registros ficticios y no acreditan escrituras productivas.

## Comprobación de esta actualización

En la PC de casa pasaron `npm run check:muni360-public` (**32 archivos públicos verificados**) y las **202 pruebas** de `npm run test:muni360` sobre `7e804e0` (`0` fallos). Al cambiar de PC, confirmar que `main` y `origin/main` coincidan y no haya cambios pendientes. La sincronización no traslada sesiones del navegador ni cargas locales pendientes: éstas se resuelven en su dispositivo, cuenta y dominio originales.

---

## Historial de etapas anteriores (hasta noviembre de 2026)

El contenido siguiente se conserva como antecedente. Sus instrucciones de ensayo y ramas antiguas quedan reemplazadas por el estado vigente de arriba.

# Muni360: continuar desde otra PC

Rama de trabajo: `revision/muni360-apps-script-cero-20261110`.
La rama main del sitio no se modifica en esta etapa.

## Estado al 10/11/2026

- Candidato Apps Script v3: Google/Firebase Spark, originales en Sheets privado y vistas por actividad.
- Paquete aplicado en una copia real del repositorio en Windows: `C:\Users\Juan\Projects\ugiccba-site`.
- Git, Node y VS Code disponibles. Se agrega comprobación de portabilidad de finales de línea Windows/Linux.
- Servicios reales de Google todavía sin configurar ni probar; la demo sigue siendo ficticia.
- No activar facturación, Cloud Run ni Firestore. No copiar secretos en GitHub.

## Primera vez en la otra PC

Con Git y Node instalados, abrir una terminal en la carpeta de proyectos:

```text
git clone --branch revision/muni360-apps-script-cero-20261110 https://github.com/ugiccba-prog/ugiccba-site.git
cd ugiccba-site
npm run test:muni360
code .
```

Si el repositorio ya existe en esa PC, revisar primero `git status`. Con la copia limpia, usar `git fetch origin`, cambiar a esta rama y ejecutar `git pull --ff-only`. Conservar cualquier cambio local antes de cambiar de rama; no usar reset destructivo.

## Para retomar desde este chat

Ejecutar Desktop Commander en la PC elegida, verificarla con la misma cuenta y mantener su terminal abierta. Avisar cuál PC se usará si hay dos conectadas. Los archivos se guardan en GitHub; el acceso a Google se autoriza en cada entorno que lo necesite.

## Próximo paso

Seguir `docs/muni360-operacion.md`: crear el entorno separado de ensayo, configurar Authentication Spark, Sheets API, propietario y copias de planillas. Luego completar `docs/muni360-pruebas-aceptacion.md` con dos cuentas reales. Los ensayos automatizados con Google simulado no reemplazan esa aceptación.

Antes de mover otra vez de PC, confirmar que los últimos cambios estén en un commit y que `git status` indique que la rama está al día con origin.


## Pendiente de publicacion — reintentos escalonados
El cambio 92f3037 agrega espera creciente a los reintentos periodicos del cliente; 113 pruebas aprobadas. Codigo guardado en la rama remota de revision. No esta publicado en Hosting: la API de Firebase devolvio 503 UNAVAILABLE al agregar los archivos y un segundo intento acotado tampoco finalizo. Ambos procesos de deploy se detuvieron; no queda reintento del asistente en segundo plano.
Se comprobo HTTP 200 para el cliente y los dos portales; siguen sirviendo la version anterior sin nextRetryAt ni retry({automatic:true}). La optimizacion backend de lecturas de la version 5 de Apps Script permanece publicada.
La carpeta privada de publicacion de esta PC contiene el frontend actualizado, con la configuracion publica recuperada del sitio vivo y validada contra el proyecto/endpoint de ensayo. Proximo paso: reintentar solo Hosting cuando la API permita publicar y comprobar los tres archivos servidos; no hace falta repetir pruebas manuales de datos ni cambiar Apps Script.


## Publicacion recuperada y horario argentino — 11 de noviembre
Firebase completo la publicacion del horario argentino y los reintentos escalonados que estaban pendientes. Se verifico HTTP 200 y coincidencia exacta con el repositorio en el modulo horario, el cliente de sincronizacion, el editor de permisos y los tres HTML de Deportes, Colonia y administracion. La comprobacion del endpoint de Apps Script tambien fue correcta. Backend de ensayo: deployment existente actualizado a version 6. Suite: 118 pruebas aprobadas. El pendiente anterior de Hosting queda resuelto.
La pagina usa America/Argentina/Buenos_Aires y muestra ARG en los instantes del historial. Los vencimientos se interpretan en Argentina y se envian como UTC. Las proyecciones Cambios/EstadoSync adoptan el formato nuevo en su proxima sincronizacion; no se forzo una escritura sobre datos activos para probarlo. Las paginas ya abiertas necesitan recargarse para cargar el frontend nuevo.

### Prioridades restantes
1. Completar en Google los casos parciales de permisos/privacidad, fallos de guardado y restauracion que la matriz conserva pendientes. Las pruebas locales no sustituyen esos resultados.
2. Medir latencias y cuotas reales con varios profes y volumen representativo en la conexion del club. Simulacion local de 20 profes y 400 participantes aprobada; no garantiza esa capacidad real.
3. Observar varias ejecuciones nocturnas de respaldo/sincronizacion y el espacio libre de Drive. Solo la primera noche tiene confirmacion real; no hay monitoreo del asistente fuera de la conversacion.
4. Revisar estetica, legibilidad y flujo de cancha en celular; recorrer la presentacion completa en el proyector. No se declaran aprobados por haber corregido el backend.
La matriz de aceptacion se actualizo con las confirmaciones que antes estaban solo en notas: cierre sobre copias, primera noche, importacion invalida, comida de Colonia y aislamiento entre actividades.


## Primera estetica de cancha publicada
Cambio 5b5bea5 guardado en la rama de revision y publicado en Firebase Hosting del ensayo. Se comprobo HTTP 200 y contenido exacto del repositorio para CSS compartido y los HTML de ambos portales. Suite: 123 pruebas aprobadas; seis recorridos de navegador local a 360/390/1440 px aprobados. Ver muni360-estetica.md para alcance y reproduccion.
La revision adicional de seguridad no encontro un fallo nuevo en los cinco casos agregados. No se marca como completa la matriz real de Google: sus casos pendientes, el rendimiento con varias cuentas reales, varios dias de respaldo y el proyector siguen diferenciados. Se paso a una primera mejora visual sin alterar ese estado de verificacion.
No quedan procesos de prueba, servidores locales ni reintentos de publicacion del asistente en segundo plano. Las herramientas de navegador de esta revision usaron perfiles nuevos y datos ficticios.


## Vista compacta unica publicada
Cambio 6761aeb publicado y verificado por HTTP con contenido exacto en ambos HTML y CSS compartido. Se retiro el boton Modo cancha; la distribucion compacta es predeterminada. Indicadores plegados al final, ayuda de referencias, cabecera/navegacion reducidas y guardado en flujo normal. Suite: 123 pruebas aprobadas. Se completaron doce recorridos de navegador local con perfiles simulados Direccion/Profe a 360, 390 y 1440 px; las fichas de Profe comienzan a 329 px en Deportes y 379 px en Colonia en las demos moviles. Referencia vigente: muni360-estetica.md.


## Profe sin Cambios y con cuatro pestanas fijas
Cambio e150ee3 publicado y verificado por HTTP con contenido exacto en CSS y ambos portales. Se retiro Cambios de la interfaz operativa; Direccion/Coordinacion conservan la vista. El registro de operaciones del servidor sigue activo. Perfil Profe habitual: Asistencia, Evaluar, Banco UGI y Analisis, en una fila sin scroll horizontal. Suite: 125 pruebas aprobadas y doce recorridos de navegador local, con comprobacion de opciones por perfil y posicion de las cuatro pestanas.


## Candidata de presentacion consolidada
Se agregan muni360-cierre-ensayo.md y muni360-guia-uso.md. El nuevo recorrido scripts/check-muni360-flow.cjs ejecuto las pantallas reales sin modo demo, conectadas al motor Apps Script mediante adaptadores en memoria: dos portales, acceso DUA sin datos privados, autoguardado, reapertura, evaluacion decimal, offline/reconexion, doble toque y panel propietario; 21 peticiones, resultado correcto. No es una prueba adicional en servicios Google reales.
Se verificaron los siete recursos principales publicados por HTTP, su coincidencia con el repositorio, salud del backend y rechazo de una peticion sin sesion. La ultima validacion de CI para 279c216 esta aprobada. El codigo de la app publicada no cambio en este cierre: se consolida la evidencia y el procedimiento de uso. La matriz real mantiene sus variantes pendientes para el piloto; el cierre es de candidata para presentacion.
