# Guía para asistentes de IA y colaboradores

Este repositorio lo trabajan varias IA (Claude, Gemini, Codex, Copilot, Cursor, etc.) y personas. **Leé este archivo entero antes de cambiar algo** y actualizalo si cambia alguna regla. El estado del proyecto y el historial están en [docs/muni360-continuidad.md](docs/muni360-continuidad.md); el índice de toda la documentación, en [docs/README.md](docs/README.md).

## Qué es

Sitio de la **UGI (Unidad de Gestión Integral) del Club Ciudad de Buenos Aires**, publicado con GitHub Pages desde `main` en `https://ugiccba.com.ar` (archivo `CNAME`).

| Parte | Dónde | Qué es |
|---|---|---|
| Sitio público | `index.html`, `pages/`, `ansiedad/`, `apps/training/` | Páginas institucionales y juegos del Gimnasio Mental |
| Comunidad | `comunidad/` | Cartelera de avisos con notificaciones push (FCM) |
| Muni360 (fuentes) | `apps/muni360/source/`, `assets/scripts/muni360-*.js`, `assets/styles/muni360-*.css` | App interna de asistencia, evaluaciones y padrones |
| Muni360 (publicado) | `muni360/` | **Generado** por `npm run build:muni360-public`. Nunca editarlo a mano |
| Backend | `server/supabase/` | Edge Function `muni360` (Deno) + SQL de Supabase. Proyecto `kaalffshnrkxviqaymhv` |
| Histórico | `archive/`, `pilots/`, `server/muni360/`, `apps-script/` | Referencia; el backend vigente es Supabase |

Ingreso con Google vía Firebase Authentication (proyecto `muni360-ugi-ensayo`). Los datos privados viven en Supabase con RLS; Google Sheets/Drive reciben vistas y respaldos desde Apps Script.

## Reglas de oro

1. **Datos de menores.** No copiar datos reales (nombres, DNI, legajos) a commits, issues, PR, pruebas ni conversaciones con servicios externos. Las pruebas y demos usan datos ficticios. No agregar analítica ni rastreo a Muni360 ni a Comunidad.
2. **Nunca editar `muni360/` directamente.** Editar las fuentes y correr `npm run build:muni360-public`. El CI falla si el paquete no coincide (`npm run check:muni360-public`).
3. **Lógica compartida de los portales.** Deportes (`apps/muni360/source/deportes/`) y Colonia/COYFD (`apps/muni360/source/colonia/`) comparten:
   - `assets/scripts/muni360-portal-comun.js`: funciones comunes. **Un cambio acá afecta a todos los portales.**
   - `assets/styles/muni360-app.css`: estilos comunes.
   - Las diferencias deliberadas entre portales están en la constante `PORTAL_MUNI` al inicio del `<script>` de cada `index.html`. Si una función pasa a necesitar una diferencia, agregá un campo a `PORTAL_MUNI` en vez de duplicar la función.
   - Antes de duplicar código entre los dos `index.html`, fijate si va en el archivo común.
4. **Content-Security-Policy.** Cada página tiene una etiqueta `<meta http-equiv="Content-Security-Policy">` con la lista de dominios permitidos. **Si agregás un servicio externo** (script, fuente, API, iframe), sumá su dominio a la directiva correcta (`script-src`, `connect-src`, `frame-src`…) en todas las páginas que lo usen; si no, el navegador lo bloquea y el error sólo aparece en la consola (F12).
5. **Versiones fijas.** Scripts de CDN con versión exacta e `integrity` (SRI), como MediaPipe en `apps/training/reaccion.html`.
6. **Finales de línea.** El repo mezcla LF y CRLF según el archivo (por ejemplo, las fuentes de Muni360 y varias pruebas del servidor usan CRLF). Respetá el final de línea que ya tiene cada archivo; herramientas como Python con `open()` en modo texto los convierten sin avisar.
7. **No commitear secretos.** La `apiKey` de Firebase en `assets/scripts/muni360-config.js` es pública por diseño; las claves de Supabase (service role), FCM y Gemini sólo viven en los secretos de Supabase.
8. **Documentar.** Todo cambio relevante se anota en [docs/muni360-continuidad.md](docs/muni360-continuidad.md) (qué, por qué, cómo se verificó y qué queda pendiente). Si cambia el backend, también en [docs/muni360-despliegue-supabase-sheets.md](docs/muni360-despliegue-supabase-sheets.md).
9. **Idioma.** Textos visibles en castellano rioplatense (vos), sin tecnicismos para el usuario final.

## Comandos

```bash
npm ci                                  # dependencias del sitio (stylelint, jshint, playwright)
npm ci --prefix pilots/supabase         # PGlite y Playwright para las pruebas del servidor

npm run test:muni360                    # 208 pruebas de las fuentes de Muni360
npm run test:mental                     # Gimnasio Mental
npm run lint:js && npm run lint:css     # deben terminar sin errores
npm run build:muni360-public            # regenera muni360/ (hacerlo después de tocar fuentes)
npm run check:muni360-public            # verifica que muni360/ esté al día

# Pruebas del servidor (Supabase en PGlite, sin red):
MUNI_PGLITE_MODULE=$PWD/pilots/supabase/node_modules/@electric-sql/pglite npm run test:server
MUNI_PGLITE_MODULE=$PWD/pilots/supabase/node_modules/@electric-sql/pglite \
MUNI360_PLAYWRIGHT_MODULE=$PWD/pilots/supabase/node_modules/playwright npm run check:server:browser

# Recorridos en navegador. check-competencia-ui y check-gimnasio-mental buscan por defecto
# el Edge de Windows: en Linux/Mac pasar MUNI360_BROWSER_PATH=/ruta/a/chromium.
node scripts/check-muni360-ui.cjs
node scripts/check-competencia-ui.cjs
node scripts/check-gimnasio-mental.cjs
```

### Verificación visual (refactors de HTML/CSS/JS de Muni360)

`scripts/check-muni360-visual.cjs` captura todas las pestañas de los 4 portales en modo demo (2 anchos, Dirección y Profe; 152 estados) con fecha y azar fijos:

```bash
npm run build:muni360-public
npm run check:muni360-visual -- capture /tmp/antes            # antes del cambio
# ...cambio + build...
npm run check:muni360-visual -- capture /tmp/despues
npm run check:muni360-visual -- compare /tmp/antes /tmp/despues   # esperado: 0 diferencias
```

Con `--styles` compara el estilo computado de **todos** los elementos (también ocultos y modales). Es lento: correr un proceso por portal con `MUNI360_VISUAL_PORTALS=muni360/colonia/` en paralelo. Las capturas toleran el ruido de suavizado de fuentes (diferencia por canal ≤ 16).

## CI (GitHub Actions)

| Workflow | Qué corre |
|---|---|
| `site-checks.yml` | lint JS y CSS, Gimnasio Mental |
| `muni360.yml` | `test:muni360` |
| `muni360-domain.yml` | `check:muni360-public` |
| `muni360-supabase-migration.yml` | `test:muni360`, pruebas del servidor y `browser-flow.cjs` |
| `muni360-supabase-pilot.yml` | piloto histórico |

Un PR se integra sólo con todo en verde. **Nunca** saltear o desactivar una prueba para que pase: si una prueba quedó vieja por un cambio de comportamiento intencional, actualizarla y explicarlo en el commit.

## Desplegar la Edge Function `muni360`

1. Correr `npm run test:server` y el recorrido en navegador.
2. Desplegar `server/supabase/functions/muni360/` completo (los 11 archivos), con `verify_jwt: false` (la función verifica el token de Firebase por su cuenta):
   - Con la CLI: `npx supabase functions deploy muni360 --project-ref kaalffshnrkxviqaymhv --no-verify-jwt`
   - Con un conector MCP de Supabase: enviar los 11 archivos. Si el contenido se transcribe a mano, **desplegar primero en una función de prueba con `verify_jwt: true`, descargarla y compararla byte a byte con el repo** antes de tocar `muni360` (así se hizo la v25).
3. Después del despliegue, descargar la función publicada y comparar con el repo; revisar los registros (`function_logs`) en el primer uso.
4. Anotar versión, fecha y verificación en la documentación.

Las migraciones SQL están en `server/supabase/sql/` numeradas; aplicar en orden y registrar en la documentación.

## Trampas conocidas

- Reemplazos masivos con `sed` sobre HTML: verificar que no toquen URLs reales (pasó con `googletagmanager` dentro del `src` de gtag).
- Las pruebas de `tests/` leen el HTML de los portales y ejecutan sus `<script>`; para que incluyan el archivo común usan `tests/helpers/portal-source.cjs` (`readPortal`). Las pruebas nuevas de portales deben usarlo.
- `apps/muni360/source/*/index.html` referencia `../assets/...`, que recién existe tras compilar; abrir las fuentes directo en el navegador no funciona, hay que usar `muni360/`.
- Desde entornos de desarrollo en la nube, `ugiccba.com.ar`, `supabase.co` y los CDN pueden estar bloqueados: las pruebas reales con Google las hace una persona en su navegador.
