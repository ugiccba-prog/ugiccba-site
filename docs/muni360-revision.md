# Muni360 · Revisión integral y candidato de Apps Script

**Fecha:** 10/11/2026. **Presupuesto:** sin infraestructura con facturación. **Objetivo:** presentación en dos semanas y piloto antes de la temporada. La fecha exacta de presentación todavía no está confirmada.

## Resultado y límite de la revisión

Se preparó un candidato coherente de Apps Script, Firebase Authentication en Spark y Sheets. Los dos portales y el panel de permisos usan el mismo backend. Pasaron **54 pruebas automatizadas locales** y una recorrida de navegador en Deportes y Colonia/COYFD: arranque de demo, modo cancha, ficha de evaluación, guardado ficticio, análisis, padrón, salida y panel de permisos.

De las 54 pruebas, **22 corresponden al candidato Apps Script y su transporte/importación**. Las otras 32 incluyen una prueba de portabilidad Windows/Linux y conservan regresiones del cliente, los portales y las alternativas anteriores; parte de ellas valida la propuesta Firestore que ya no se recomienda desplegar. No se las presenta como 54 ensayos independientes de producción.

Los servicios de Google se simulan en las pruebas: validación de identidad, respuestas de Sheets, atomicidad, errores, pérdida de respuesta y Drive. **No se ha configurado ni ejecutado este código en el proyecto real de Google.** No están medidos aún su CORS/redirección real, latencia, rendimiento simultáneo ni consumo diario real de cuotas. La prueba de 500 personas y 6.000 asistencias demuestra comportamiento y volumen local; no certifica capacidad de Apps Script.

La rama de GitHub pública revisada seguía en el commit `0aaa985beee36c638832e335fe57c251bf0a9596`. La integración rechazó crear la rama de revisión con HTTP 403 `Resource not accessible by integration`. No se publicó un PR ni se modificó el sitio del club o sus planillas.

## Qué se modificó y cómo comprobarlo

| Área | Hallazgo | Cambio preparado | Evidencia local / pendiente |
| --- | --- | --- | --- |
| Arquitectura | La interfaz esperaba un servidor Node y el script no implementaba sus rutas. | POST único al `/exec` con rutas internas y comprobación de versión exacta. | Cliente y backend integrados; falta ensayo HTTP en Google. |
| Login | El script anterior conservaba contraseñas propias. | Google mediante Firebase Auth y verificación oficial `accounts:lookup`; controles de proyecto, proveedor, correo, vencimiento y revocación. | Tokens inventados, ajenos y vencidos rechazados con simulación. Falta cuenta real. |
| Alta de profes | La identidad podía confundirse con el permiso. | Alta pendiente sin datos; sólo el UID propietario configurado puede aprobar. | Pruebas de cuenta nueva, autoascenso y dueño protegido. |
| Coberturas | Un reemplazo necesita cubrir equipos ajenos. | Todos los equipos dentro de las actividades autorizadas. Reemplazos con vencimiento obligatorio. | Dos equipos, otra actividad bloqueada y validación de vencimiento. |
| Permisos | No alcanzaba con ocultar botones. | Estado, rol y permisos se leen en cada solicitud del servidor. | Suspensión y consulta impiden nuevas escrituras; DNI y legajo separados. |
| Guardado | Un bloqueo no convierte varias escrituras de Sheets en una transacción. | Original, revisión, recibo y antes/después se escriben en un único batch de Sheets. | Fallo anterior al commit deja todo intacto; respuesta perdida permite recuperar recibo. |
| Reintentos | Reenviar con un ID nuevo podía duplicar una sesión ya guardada. | Consulta de recibo antes de revisar/recrear una operación. ID ligado a usuario y huella del contenido. | Sesión guardada con respuesta perdida no se duplica. |
| Dos profes | Una lista vieja podía pisar otra carga o un plantel cambiado. | Revisión por recurso, temporada, versión del acceso y listado de identidades del grupo. Claves normalizadas. | Conflicto ante segunda escritura vieja, cambio de plantel y cambio de acceso. |
| Auditoría | Faltaba un historial completo en Apps Script. | Autor autenticado, fecha UTC, tipo, actividad, grupo, versión y antes/después. | El profe ve sus cambios; el reconocimiento no filtra otras notas privadas. |
| Identidades | Un nombre o un cambio de DNI podía mezclar personas. | ID estable, registro privado de vínculos y reserva de DNI rectificado para revisión. | Misma identidad en dos actividades, baja/alta y rectificación sin cambiar su ID. |
| Privacidad en Sheets | Las vistas no debían llevar todo el legajo. | Vistas sin DNI, legajos, notas de sesiones ni detalles privados de auditoría. | Prueba de salida pública y fallo de sincronización sin pérdida del original. |
| Temporadas | Un cierre podía borrar datos o exceder el tamaño del batch. | Archivo completo comprimido en Sheets, limpieza en la misma transacción y consulta histórica. | Archivo y lectura de 6.000 asistencias; fallo atómico no vacía el ciclo. |
| Escala | Reescribir todo el historial en cada carga crecía demasiado. | Cambios por tramos de filas, auditorías y recibos por append atómico; sincronización por lotes con rotación. | 500 personas, 12 fechas, 6.000 registros y cierre posterior. Falta carga simultánea real. |
| Respaldos | No bastaba con declarar que había backup. | Copia diaria privada; resultado confirmado, sin duplicar en el día, con detección de error y verificación de privacidad. | Simulación de copia correcta, espacio/error y carpeta compartida rechazada. Restauración real pendiente. |
| Excel | Lector antiguo externo y heurística ambigua de columnas. | SheetJS 0.20.3 local con licencia, encabezados explícitos, límites y validación. | Libro XLSX real con acentos y fórmulas como texto; duplicados y DNI inválidos rechazados. |
| Padrón | Un alta sólo con nombres podía borrar el DNI anterior. | Campo DNI omitido cuando no se informa. | Regresión específica preserva el DNI existente. |
| Interfaz | Doble toque y respuestas viejas podían afectar otra cuenta o grupo. | Bloqueo de controles durante envío; respuesta de lectura ligada al cliente/cuenta; salida sin referencia a contraseña eliminada. | Arranque y salida en navegador; falta ensayo prolongado en móvil real. |
| Operación | Las copias a las vistas podían fallar sin explicarse. | Estados separados: original guardado / vistas pendientes. Botón manual de Dirección, diagnóstico y activadores. | Falla de destino no revierte el original. Activadores reales pendientes. |
| Costos | Cloud Run requiere facturación pese a su cuota gratuita. | Backend Apps Script; sin Cloud Run/Firestore/Blaze. Cuotas y Drive se monitorean. | No se activó facturación. Falta medir uso real esperado. |

## Qué contiene el candidato

- `apps-script/`: cuatro archivos `.gs` y manifiesto. Son los únicos archivos para instalar en el proyecto nuevo.
- `assets/scripts/muni360-{config,google,sync,admin,import}.js`: configuración pública, login, cola, permisos e importación.
- `assets/vendor/`: lector XLSX local y su licencia. No necesita otro servicio para importar o exportar.
- `muni360/`, `muni360cyc/`, `admin/`: portales y panel.
- `tests/`: pruebas reproducibles, simuladores de servicios y regresiones.
- `scripts/build-apps-script.cjs`: genera el dominio GAS desde las mismas reglas puras probadas en Node.
- `archive/apps-script-v2/`: referencia histórica. No se instala.
- `server/muni360/`: alternativa anterior de servidor; no desplegar para este plan. `domain.cjs` y `policy.cjs` también son fuentes de generación del dominio GAS.

Comandos de comprobación, desde el directorio del repositorio con Node 22:

```bash
node scripts/build-apps-script.cjs --check
npm run test:muni360
git diff --check
```

No hace falta instalar paquetes para estas pruebas. El lector XLSX ya está incluido. Si se cambian las reglas del dominio, ejecutar primero `node scripts/build-apps-script.cjs` y volver a comprobar.

## Plan de dos semanas

Es una secuencia de trabajo, no una automatización ni una promesa de tareas ejecutándose después de esta conversación.

| Tramo | Trabajo | Condición de salida |
| --- | --- | --- |
| Días 1–2 | Inventario, copias y proyecto de ensayo; resolver escritura de GitHub. Configurar Spark, Sheets API, propietario y dominios. | Login real y acceso pendiente sin filtrar datos. |
| Días 3–4 | Guardado, aprobaciones, grupos/equipos, DNI, DUA, bitácora y vistas. | Dirección y dos profes completan los flujos sin errores críticos. |
| Días 5–6 | Dos usuarios simultáneos, conexión cortada, permisos revocados, dispositivo compartido y datos inválidos. | Sin duplicaciones, pérdida ni reemplazo silencioso. |
| Días 7–8 | Volumen representativo del club; medir latencias, cuotas y sincronización en horario de uso. | Límites y demoras conocidos; objetivo de guardado acordado y medido. |
| Días 9–10 | Respaldo y restauración real; cierre de temporada y comparación. | Recuperación demostrada con conciliación de cambios posteriores al respaldo. |
| Días 11–12 | Ensayo completo de presentación con las cuentas y dispositivos que se usarán. | Demostración de punta a punta, sin depender de la demo ficticia. |
| Día 13 | Congelar versión; respaldo; repetir casos críticos y revisar permisos. | Ningún bloqueo crítico abierto y URL/versiones registradas. |
| Día 14 | Presentación. Mostrar el alcance real y el plan de piloto de temporada. | Evidencia de funcionamiento y límites explicados con claridad. |

No reservar las últimas 24 horas para configurar Google. Si un paso crítico no pasa, presentar la demo ficticia como prototipo y explicar lo pendiente; no afirmar que el sistema real ya está validado.

## Pendientes que bloquean la aprobación final

1. Configurar el proyecto real de ensayo y habilitar la escritura de GitHub, o aplicar manualmente el paquete en una rama revisable.
2. Ejecutar la matriz con dos cuentas reales, Chrome Android y PC. La prueba en este navegador de trabajo no reemplaza el dispositivo que se usará en cancha.
3. Validar lectura CORS/redirección de Google, popup de login y revocación real de Firebase. No usar `no-cors` como atajo.
4. Medir los tiempos y cuotas con cantidad real de profes, equipos y cargas. La identidad se consulta a Google en cada solicitud; debe contarse ese consumo de UrlFetch.
5. Ensayar restauración, revisar permisos de Drive y definir conservación de respaldos dentro del espacio gratuito disponible.
6. Confirmar si existen históricos reales previos. Esta entrega no ejecuta una migración masiva de esos históricos ni inventa datos faltantes.
7. Revisar contenidos metodológicos y criterios de UGI con Dirección. Las alertas no deciden sanciones, diagnósticos ni planes automáticamente.

La auditoría es trazabilidad de la app, no un registro inviolable frente a la persona propietaria de la planilla. Las ediciones hechas directamente en Sheets no permiten atribuir automáticamente cada cambio a un profe de la app. Por eso las tablas originales se mantienen privadas y las cargas operativas pasan por el sistema.

## Fuentes técnicas consultadas

- [Firebase REST: consulta oficial de la cuenta mediante ID token](https://firebase.google.com/docs/reference/rest/auth)
- [Firebase Web: configuración y SDK](https://firebase.google.com/docs/web/setup)
- [Firebase: planes Spark y Blaze](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Sheets: atomicidad de batchUpdate y límite de la edición colaborativa](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
- [Apps Script: cuotas, límites y monitoreo](https://developers.google.com/apps-script/guides/services/quotas)
- [Apps Script: publicación de aplicaciones web](https://developers.google.com/apps-script/guides/web)
- [Apps Script: redirección de Content Service](https://developers.google.com/apps-script/guides/content)
- [SheetJS: distribución oficial y copia local recomendada](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)
