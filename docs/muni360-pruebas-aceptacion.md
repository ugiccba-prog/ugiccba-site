# Muni360 · Matriz de aceptación en ensayo (Supabase + Google Auth/Sheets)

Versión activa `supabase-1.0.0` (corte verificado el 12/11/2026 desde `apps-script-3.0.0`) · Publicada en `https://ugiccba.com.ar/ensayo360muni/`. El estado de los ensayos reales se actualiza únicamente con evidencia del entorno publicado o confirmación del usuario. Las pruebas locales automáticas (PGlite / simuladores) no completan estas casillas. Usar datos ficticios.

Registrar para cada caso: fecha, cuenta/rol, dispositivo/navegador, ID de operación cuando exista, resultado esperado/obtenido, captura sin información sensible y responsable de aprobación. Los IDs de operaciones sirven para localizar el recibo y la auditoría sin copiar tokens ni datos personales a un informe público.

## Preparación

- Una cuenta propietaria, dos profes distintos, una cuenta pendiente, una de consulta y un reemplazo con vencimiento cercano.
- Dos actividades; dos equipos en una de ellas; un grupo de Colonia con comida.
- Entre 8 y 15 deportistas ficticios por grupo; al menos uno sin DNI y uno con apoyo DUA.
- Dos dispositivos, incluyendo Android real; conexión que se pueda desconectar y recuperar.
- Copia de las propiedades privada y backup inicial confirmado.

## Casos

| ID | Acción | Resultado que se exige | Estado |
| --- | --- | --- | --- |
| G01 | Abrir sin sesión y consultar el endpoint por GET. | Sólo estado general; ningún padrón, ficha o token. | Verificado por HTTP |
| G02 | Ingresar con una cuenta nueva de Google. | Acceso pendiente; no recibe datos de una actividad. | Pendiente |
| G03 | Aprobar desde la cuenta propietaria. | El profe entra al revisar acceso; alta de permiso con autor, antes y después. | Confirmado por usuario: ingreso aprobado, 3 usuarios e historial de permisos visibles en /ensayo360muni/admin/ |
| G04 | Intentar abrir administración como profe. | Sin capacidad de listar ni modificar usuarios. | Confirmado por usuario: enlace directo rechazado; sin lista de usuarios |
| G05 | Intentar modificar al propietario desde su panel. | Rechazo; no puede quitarse accidentalmente el control. | Confirmado por usuario en /ensayo360muni/admin/: rechazo al intentar modificar la cuenta propietaria |
| G06 | Abrir todos los equipos de una actividad autorizada. | Acceso a todos, incluyendo el equipo cubierto por reemplazo. | Parcial: acceso de profe confirmado; cobertura completa pendiente |
| G07 | Pedir otra actividad no autorizada. | Rechazo del servidor, aunque se altere la interfaz. | Verificado por usuario: Colonia retirada rechaza y Hockey autorizado permite leer/guardar con pendiente ajeno |
| G08 | Suspender al profe mientras tiene la app abierta. | La siguiente petición no recibe datos ni guarda cambios nuevos. | Parcial real: envío suspendido rechazado; lectura pendiente |
| G09 | Cambiar actividades/permisos con un pendiente de ese profe. | La carga requiere revisión con el acceso actualizado; no se reenvía a otra cuenta. | Parcial real: reactivación y revisión del pendiente confirmadas |
| G10 | Dejar vencer un reemplazo y volver a consultar/guardar. | Acceso vencido; Dirección puede renovarlo. | Parcial real: vencimiento rechaza y renovación recupera; guardado previo al vencimiento por confirmar |
| G11 | Usar una cuenta de consulta. | Lectura autorizada y todas las escrituras rechazadas. | Confirmado por usuario: lectura y navegación disponibles, controles de escritura bloqueados |
| D01 | Profe consulta padrón y apoyo DUA. | Sin DNI ni bitácora privada; apoyo operativo correcto de la persona elegida. | Confirmado por usuario: Padrón oculto a Profe, apoyo DUA operativo y vista de Sheets sin DNI ni nota privada |
| D02 | Dirección abre legajo y agrega una nota. | Nota compartida entre sesiones autorizadas, autor real y fecha; no sólo memoria local. | Confirmado por usuario en /ensayo360muni/deportes/: nota de legajo privado guardada en Supabase con autor y fecha |
| D03 | Intentar modificar una nota histórica. | Se conserva; se pide una rectificación como evento nuevo. | Verificado en Chrome + Supabase (PGlite): bitácora histórica sin controles de edición/borrado; exige evento nuevo (pendiente en sesión Google real) |
| D04 | Profe registra una tarjeta verde. | Evento propio en la bitácora; no recibe otras notas privadas en respuesta o auditoría. | Confirmado por usuario: reconocimiento con autor y nota privada conservada |
| D05 | Mismo DNI/persona en dos actividades. | Identidad estable; no mezcla el contexto privado de las actividades. | Pendiente |
| D06 | Corregir DNI y tratar de reutilizar el anterior para otra persona. | ID estable y conflicto para revisar el DNI reservado; sin herencia silenciosa de ficha. | Pendiente |
| P01 | Pegar dos renglones de nombres y cargar en un grupo. | Dos deportistas; no se concatenan los renglones. | Verificado en Chrome + Supabase (PGlite): pegado de dos renglones crea dos deportistas separados (pendiente en sesión Google real) |
| P02 | Importar Apellido/Nombre/DNI con acentos y ceros vacíos. | Vista previa correcta; no adivina categorías ni sustituye DNI por otra cifra. | Parcial real: acentos, vista previa e importacion con DNI vacio confirmados; DNI valido pendiente |
| P03 | Importar nombre repetido, DNI inválido, más de 500 filas o más de 2 MB. | Mensaje claro y ninguna carga parcial. | Parcial real: duplicado, DNI invalido y archivo mixto rechazados sin carga parcial; limites de filas/tamano solo automatizados |
| P04 | Reimportar un nombre existente sin DNI. | Conserva DNI e identidad. | Verificado en Chrome + Supabase (PGlite): reimportar nombre existente sin DNI conserva DNI 12345678 e identidad (pendiente en sesión Google real) |
| P05 | Preparar nombres en CargaPadron y revisarlos en la app. | Se confirma el grupo de destino y se registra la persona que importó. | Pendiente |
| A01 | Abrir fecha nueva sin asistencia. | Sin registrar y sin observar; no inventa presentes ni verdes. | Verificado en Chrome + Supabase (PGlite): fecha nueva abre con todos los registros en '-' sin inventar presentes ni verdes (pendiente en sesión Google real) |
| A02 | Guardar P/A/T, semáforos y comida en Colonia. | Datos correctos al recargar; comida sólo según la selección realizada. | Confirmado por usuario: asistencia, semaforo y comida de Colonia conservados; ausente sin comida |
| A03 | Guardar fecha inválida o un alumno fuera del grupo. | Rechazo sin cambiar datos/versiones. | Pendiente |
| A04 | Doble toque rápido en Guardar. | Una operación en curso; sin dos eventos involuntarios. | Pendiente |
| A05 | Dos profes abren la misma fecha y guardan versiones distintas. | Se confirma la primera; la segunda requiere comparar y revisar. | Parcial real: conflicto bloqueado y dato anterior visible; cierre del pendiente por confirmar |
| A06 | Cambiar el padrón después de que otro profe abrió su lista. | La lista vieja se bloquea por cambio de plantel. | Pendiente |
| A07 | Cortar red antes de guardar y recargar la página. | Pendiente por cuenta recuperable; no muestra guardado confirmado. | Parcial real: corte y reconexión automática confirmados; recarga sin red pendiente |
| A08 | Cortar respuesta después de llegar a Google y reintentar. | Un recibo y un cambio; no duplica el registro. | Pendiente |
| A09 | Respuesta perdida de una sesión UGI y usar Revisar pendiente. | Detecta que ya estaba guardada antes de generar otra operación. | Pendiente |
| A10 | Salir con pendientes y entrar con otra cuenta. | No ve ni envía pendientes de la cuenta anterior. | Pendiente |
| A11 | Cambiar grupo o fecha con asistencia sin guardar. | Advertencia; cancelar mantiene el contexto y los cambios. | Verificado en Chrome + Supabase (PGlite): advertencia al cambiar fecha/grupo con borrador sin guardar; cancelar conserva fecha y selección (pendiente en sesión Google real) |
| E01 | Evaluar una variable, decimales y notas fuera de 1–10. | Sólo valores válidos; sin promedio técnico/formativo mezclado. | Verificado en Chrome + Supabase (PGlite): nota decimal 7,5 válida y promedios técnico (7,5) / formativo (8,0) separados (pendiente en sesión Google real) |
| E02 | Guardar evaluación y volver a abrirla. | Mismos valores; autor y cambio presentes en historial. | Parcial real + verificado en Chrome/Supabase: evaluación decimal recuperada tras conflicto y al reabrir jugador (7,5 y 8) |
| E03 | Consultar análisis sin datos y con pocos datos. | Sin divisiones por cero; sin convertir ausencia de observación en buen resultado. | Verificado en Chrome + Supabase (PGlite): análisis sin datos muestra '-' / 'Sin evaluar' sin dividir por cero ni inventar buen resultado (pendiente en sesión Google real) |
| E04 | Exportar XLSX con permiso y sin permiso. | Archivo correcto para autorizado; bloqueo para quien no puede exportar. | Confirmado por usuario: XLSX correcto y descarga sin permiso rechazada |
| H01 | Consultar Cambios como profe y como Dirección. | Alcance correcto, autor, fecha y antes/después de cada operación. | Parcial: autor en Sheets; alcance completo pendiente |
| H02 | Registrar una sesión y contrastar el autor enviado por el navegador. | Se usa el usuario autenticado, no un autor escrito libremente. | Pendiente |
| S01 | Guardar y pulsar Actualizar vistas de Sheets desde Dirección. | Original, vista y EstadoSync consistentes. | Verificado en Supabase y confirmado por usuario en /ensayo360muni/: guardado en base y Actualizar vistas de Sheets sin DNI ni legajo privado |
| S02 | Hacer fallar el destino de la vista. | Original confirmado y vista pendiente; reintento sin pérdida. | Pendiente |
| S03 | Hacer fallar el original privado. | No se confirma la carga ni aparecen datos/auditoría parciales. | Pendiente |
| S04 | Agregar una pestaña propia y sincronizar. | La pestaña propia se conserva; las vistas operativas se actualizan. | Pendiente |
| S05 | Editar manualmente una tabla original con estado ya confirmado. | Nuevas cargas bloqueadas por discrepancia para revisión. | Pendiente |
| S06 | Probar filas que comienzan por =, +, - o @. | Texto literal en Sheets y XLSX; no se ejecutan fórmulas de entrada. | Pendiente |
| T01 | Archivar temporada conservando padrón. | Historial recuperable; nueva asistencia/evaluación vacía y padrón conservado. | Verificado en Google sobre copia privada: padron/fichas conservados e historial consultable |
| T02 | Archivar con padrón vacío nuevo y revisar una ficha anterior. | Copia histórica y legajos preservados según acceso. | Verificado en Google sobre copia privada: nuevo padron vacio y archivo/fichas conservados |
| T03 | Intentar archivar con pendientes o enviar un pendiente de temporada vieja. | Se bloquea; no mezcla ciclos. | Parcial real: servidor rechaza temporada anterior; interfaz con cola pendiente solo automatizada |
| T04 | Interrumpir un cierre de temporada. | Todo aplicado o todo intacto; recuperar el mismo recibo si se perdió la respuesta. | Pendiente |
| B01 | Crear respaldo dos veces el mismo día. | Una copia confirmada; sin crecimiento duplicado por reintento normal. | Verificado en Google: copia diaria sin duplicado |
| B02 | Probar carpeta compartida, sin permisos o Drive sin espacio. | No declara respaldo correcto; conserva originales. | Pendiente |
| B03 | Restaurar en una copia y comparar registros posteriores al respaldo. | Recuperación documentada y conciliación; no se prometen datos posteriores a la copia. | Verificado en Google: recuperación exacta y cambio posterior excluido |
| B04 | Verificar activadores durante varios días. | Ejecuciones verificables, vistas al día y respaldo real; no sólo activador creado. | Parcial real: primera ejecucion nocturna y archivo con datos confirmados; varios dias pendientes |
| V01 | Simular el pico real de profes y planteles. | Medir latencia mediana/p95, errores y cuotas; sin pérdida ni duplicación. | Parcial: simulacion local de 20 profes/400 personas; tiempos y cuotas reales pendientes |
| V02 | Probar 500 personas y volumen de una temporada. | Confirmar rendimiento real, tamaño, cierre e historial, sin habilitar facturación. | Parcial: 500 personas/6000 asistencias en pruebas locales; volumen real en Google pendiente |
| V03 | Usar Android, PC y el proyector de la presentación. | Login, teclado, botones de cancha y estados legibles. | Parcial: PC y Android; proyector pendiente |
| V04 | Recorrer el guion completo dos veces con cuentas reales. | Dos ejecuciones completas reproducibles, sin fallas críticas. | Pendiente |

## Criterio de aprobación

Todos los casos de identidad, permisos, privacidad, guardado, duplicación, conflicto, respaldo y recuperación deben pasar. Un fallo ahí impide habilitar datos reales, aunque el diseño se vea terminado. Errores de presentación menores se registran con fecha y responsable; no se esconden bajo una aprobación general.

Medir rendimiento en las condiciones de la cancha. Como objetivo inicial de ensayo puede tomarse un guardado usual en menos de 5 segundos y un p95 menor a 10 segundos, **objetivos todavía no medidos ni garantizados**. Si no se alcanzan, revisar el cuello de botella y el volumen antes de la temporada.

La presentación debe mostrar: login de Google → acceso pendiente → aprobación → equipo cubierto por otro profe → asistencia → evaluación/reconocimiento → historial → Sheets → respaldo confirmado. Usar sólo nombres ficticios en la pantalla pública.

## Autoguardado y actualización de vistas

El usuario confirmó el autoguardado y la llegada a Sheets primero con Dirección y luego con Profe, sin pulsar Guardar ni Actualizar vistas. Posteriormente se confirmó el corte de red con reconexión automática, el bloqueo por suspensión, la revisión tras reactivar y la detección de conflictos entre dispositivos. La recuperación se verificó en Google. Las variantes pendientes se mantienen indicadas en la matriz. Sus pruebas automatizadas constan en tests/muni360-resilience.test.cjs.

Para el ensayo real de recuperación, ejecutar ensayarRespaldoYRecuperacionUGI desde el editor del proyecto vinculado a la planilla nueva de ensayo. La función crea un checkpoint y copias privadas de recuperación, compara todas las tablas, introduce un cambio posterior únicamente en una copia y verifica otra recuperación al punto original. Luego comprueba la deduplicación del respaldo diario y programa una ejecución diaria a las 2 h de Buenos Aires. Conservar el registro RESPALDO_Y_RECUPERACION_VERIFICADOS. Crear el activador no verifica sus futuras ejecuciones: B04 sigue pendiente hasta observarlas. Nunca restaura sobre el original.

## Registro de verificación del 10 de noviembre de 2026

- Ejecución real de respaldo: recuperación exacta de 11 pestañas y 60 filas, exclusión del cambio posterior simulado, copia diaria sin duplicado y activador diario programado. Evidencia: registro de ejecución aportado por el usuario. Las ejecuciones futuras siguen pendientes de observación.
- Corte real de conexión: la app indicó carga pendiente y al reconectar actualizó Sheets sin botones, según confirmación del usuario. No se probó aún recargar la página estando desconectado.
- Suspensión real: una sesión abierta recibió el rechazo por acceso suspendido. Después de reactivar y revisar el pendiente, el usuario confirmó la recuperación.
- Conflicto real: dos dispositivos enviaron valores distintos desde la misma revisión; el segundo quedó bloqueado y mostró el valor confirmado por el primero al consultar los datos actuales. No se da por probado el cierre del pendiente hasta su confirmación.
- La suite automatizada aprobó 70 casos tanto en la PC de trabajo como en la PC de continuidad. Esto no sustituye los casos reales que permanecen pendientes.

## Corrección de refresco del padrón
Se reprodujo que una caché vacía mostraba temporalmente cero jugadores al refrescar, aunque existiera un snapshot confirmado. También se reprodujo una respuesta anterior que reemplazaba una más reciente. Se agregaron pruebas de espera y falla de red, respuestas fuera de orden, cambio de sesión y separación entre actividades. La evaluación pendiente conserva dos notas de 6,5 y se confirma al revisar el nuevo padrón. Falta repetir el recorrido completo en Google después de publicar la corrección.

## Modo Consulta
Se comprobó el rechazo de escritura por el servidor. La interfaz permitía generar un pendiente improcedente: se bloquearon los controles de escritura, los borradores automáticos y el alta local de operaciones para Consulta. La navegación, lectura y selección de fecha o grupo permanecen disponibles. Falta repetir la comprobación real con la versión corregida.

## Separación de pendientes entre actividades
Se reprodujo que un pendiente de Colonia bloqueaba la carga del padrón y nuevos guardados de Hockey. Se limitaron los bloqueos a la actividad afectada y se conservó el pendiente original con su identificador. La cola procesa las otras actividades sin saltar operaciones dentro de la misma actividad bloqueada. El aviso identifica a qué actividad corresponde el pendiente. Pruebas automatizadas: lectura con pendiente ajeno, retirada de autorización, rechazo real de la capa de permisos y continuidad de la actividad autorizada; 94 casos aprobados. Falta repetir el recorrido en Google después de publicar.

El usuario también confirmó la separación por fecha y grupo, el guardado de evaluaciones, la comida de Colonia sin asignación al ausente, Consulta con lectura disponible y edición bloqueada, y la exportación numérica con rechazo para una cuenta sin permiso.

## Punto de continuidad después de la importación
- Confirmado por el usuario: archivo leído, jugadores importados visibles tras recargar y en Sheets, acentos conservados y reimportación del mismo archivo al mismo grupo sin duplicar los dos participantes.
- Confirmado por el usuario: un archivo con nombre repetido muestra el rechazo por duplicado.
- Pendiente inmediato: probar un DNI inválido de tres cifras en una copia de ensayo y confirmar que no se guarda ningún participante.
- También confirmado después de la corrección: Hockey carga y guarda con un pendiente rechazado de Colonia, sin rehabilitar el acceso retirado.
- Última suite ejecutada: 98 pruebas automatizadas aprobadas. No equivale a aprobar todos los casos reales.
- Próximos bloques: importación inválida y límites, verificación de las ejecuciones programadas de respaldo, cierre de temporada sobre ensayo y medición de rendimiento. Los casos no ejecutados siguen pendientes.
- No quedan procesos del asistente programados para revisar o modificar el código fuera de una conversación activa.

## Verificacion del 11 de noviembre de 2026
- El usuario verifico la ejecucion nocturna completada de respaldo y sincronizacion. Abrio el archivo de respaldo del dia y confirmo que contiene datos. B04 sigue parcial: una noche observada no verifica varios dias.
- Importacion: DNI invalido rechazado; archivo con filas validas e invalidas rechazado sin agregar participantes, segun confirmacion del usuario.
- Se preparo ensayarCierreTemporadaUGI, funcion exclusiva del editor del ensayo. Crea copias privadas del original y de sus vistas y usa el mismo motor de operaciones con destinos locales a esas copias. No reemplaza la configuracion activa.
- El recorrido verifica ambos modos de cierre, conservacion de fichas, archivo exacto, lectura historica, reintento sin duplicado, rechazo de temporada anterior, sincronizacion de la copia y originales intactos. Se agrega una sesion ficticia solamente en la copia para verificar su archivo.
- Ejecutar desde el editor y conservar CIERRE_TEMPORADA_VERIFICADO. Puede demorar varios minutos. Durante el recorrido evitar cargas para facilitar la observacion; utiliza el bloqueo del script. Si falla, conservar el error y las copias para diagnostico. Una falla no restaura ni reemplaza originales.
- T01/T02 y la prueba real de este recorrido permanecen pendientes hasta observar su ejecucion en Google. T03 conserva pendiente el recorrido de la interfaz con cargas en cola. La interrupcion real de Google de T04 no se da por probada con simulaciones locales.


### Error real detectado al leer el cierre de prueba
La primera ejecucion en Google fallo en unchunksUGI, despues del cierre sobre la copia, porque Utilities.ungzip recibia un blob con tipo de contenido nulo. Se especifican application/gzip y un nombre .gz al reconstruir el archivo. No cambia el formato almacenado. Se agrego una prueba que falla con el codigo anterior y exige el tipo al descomprimir, con texto Unicode y notas decimales. La ejecucion real del cierre sigue pendiente de repeticion; no se declara aprobada a partir de las pruebas locales.


### Limite real de lecturas durante el cierre aislado
La repeticion del cierre alcanzo el limite de lecturas por minuto y usuario de Sheets al sincronizar la copia. Se difieren las proyecciones intermedias solo en la configuracion local de las copias y se verifica una proyeccion final. Las huellas reutilizan los metadatos ya consultados. El recorrido espacia cada llamada de lectura 1100 ms y permite seis reintentos con espera exponencial y variacion aleatoria; restablece la politica local aun si falla.
La capa general reintenta exclusivamente lecturas rechazadas por cuota, con dos reintentos acotados; despues devuelve RED. No reintenta escrituras ni errores de permisos. No cambia propiedades de sincronizacion ni cuotas ni facturacion.
Se prueban metadata y valores, rechazo persistente, errores de permisos y recorrido completo con reloj simulado, cuota inicial agotada y limite de 60 lecturas/minuto. La ejecucion real sigue pendiente. La prueba puede tardar entre dos y cuatro minutos; mantener la app sin nuevas cargas durante ese recorrido.
Referencia tecnica: https://developers.google.com/workspace/sheets/api/limits


### Cierre aislado confirmado en Google — 11 de noviembre
El usuario aporto el registro CIERRE_TEMPORADA_VERIFICADO, ok:true y ejecucion completada entre las 12:25:09 y 12:26:40 de Buenos Aires. Todas las verificaciones del recorrido resultaron verdaderas: padron y fichas conservados, historial consultable, reintento sin duplicado, temporada anterior rechazada, inicio sin padron, Sheets verificado y originales intactos.
La copia contenia 6 registros de padron, 14 asistencias, 4 evaluaciones y 1 sesion (marcador agregado solo en la copia). T01 y T02 quedan verificados en Google mediante el motor real sobre copias privadas; no equivale a probar el recorrido de sus botones en la app. T03 confirma el rechazo del servidor por temporada anterior, pero mantiene pendiente la interfaz con cargas en cola. T04 mantiene pendiente la interrupcion real de un cierre. El ensayo activo no fue archivado.
La suite previa a esta ejecucion aprobo 105 pruebas automatizadas. Siguiente bloque: medir tiempos reales de lectura, guardado y sincronizacion con volumen y concurrencia representativos. No se declara aprobado rendimiento por la duracion de esta prueba, que incluye esperas deliberadas para las cuotas.


### Carga local y reduccion de lecturas
Se ejecutaron cuatro escenarios de 20 clientes Profe y hasta 400 participantes: grupos distintos, conflicto sobre el mismo grupo, recarga offline con respuesta perdida y recuperacion bajo cuota simulada. No hubo perdida ni duplicacion de registros; los conflictos se conservaron para revision y las vistas finales se verificaron.
Se redujeron las lecturas promedio por guardado con sincronizacion de 11,95 a 7,95 reutilizando metadatos solo dentro de la solicitud y pasando el estado confirmado a la proyeccion. El aislamiento de cache y su invalidacion ante escrituras y respuestas perdidas tienen regresiones especificas. Suite final: 110 pruebas aprobadas.
Detalle y limites: muni360-carga-local.md. V01/V02 siguen parciales: son pruebas del cliente y motor reales con adaptadores simulados; no miden latencia autenticada ni concurrencia real de Google. No se cargaron datos de prueba adicionales en el ensayo activo. La restriccion de presupuesto cero se mantiene sin cambios de facturacion.


### Reintentos automaticos escalonados
Se verifico que el temporizador de la app no consulta Google cuando no hay pendientes. Se agrego espera creciente con variacion aleatoria para reintentos periodicos despues de errores transitorios: aproximadamente 30, 60, 120 y 240 segundos, con un maximo de cinco minutos. El temporizador puede agregar hasta su siguiente tick de 30 segundos. El boton manual y la reconexion pueden intentar de inmediato. Un guardado confirmado reinicia la espera.
La espera solo vive en memoria; la carga y su identificador permanecen en el almacenamiento por cuenta. Una recarga permite un nuevo intento inmediato sin cambiar ese identificador. Los errores de permisos y conflictos no se reenvian automaticamente. No se retrasa la carga inicial del usuario.
Se agregaron controles de reloj simulado, distribucion entre dispositivos, tope de espera, intento manual, persistencia del identificador, reinicio tras confirmar y ausencia de consultas sin pendientes. Suite: 113 pruebas aprobadas. Corresponde al cliente de ambos portales; no cambia el backend ni el formato de los datos.


### Horario argentino unificado
Se fija America/Argentina/Buenos_Aires en ambos portales y administracion. Historial de cambios, bitacoras, sesiones, archivos y estado de respaldo muestran fecha/hora argentina con indicador ARG. La fecha inicial de clase y las agrupaciones por dia tambien usan esa zona, independientemente del dispositivo.
El vencimiento del editor se muestra e interpreta en Argentina; se convierte al instante UTC antes de enviar al servidor. Los registros y controles de expiracion conservan instantes UTC para ordenar y verificar sin ambiguedad. Las proyecciones Cambios y EstadoSync de Sheets muestran horario argentino en su siguiente sincronizacion; no se modifican datos existentes desde una lectura.
Pruebas nuevas: mismo resultado con zonas UTC, Tokio, Honolulu y Buenos Aires; cruce de medianoche/anio, fechas de clase sin corrimiento, vencimiento de ida y vuelta, fechas imposibles, historial visible de ambos portales, editor de permisos y proyeccion. Suite completa: 118 pruebas aprobadas. La publicacion se verifica por separado; aprobar pruebas no implica que Firebase haya aceptado el despliegue.


### Revision de seguridad y primera estetica de cancha
Se agregaron cinco recorridos automaticos de seguridad: una sesion abierta pierde lectura/escritura al suspender, retirar actividad o vencer; campos de rol falsificados no elevan privilegios; el propietario no puede suspenderse desde el panel; las notas previas no se reemplazan ni eliminan al omitirlas; archivos y vistas no entregan DNI/notas privadas al profe; respaldo con carpeta compartida o fallo de espacio no confirma una copia. No se encontro un defecto nuevo en esos recorridos. Son pruebas locales del motor; no completan por si solas las casillas reales pendientes.
La primera revision estetica de Deportes y Colonia/COYFD se verifico en Chrome aislado con seis recorridos (360, 390 y 1440 px por portal): sin desborde horizontal ni errores JavaScript, controles tactiles de 44 px, cambios de asistencia/semaforo, filtros, evaluacion y acceso al ultimo registro con guardado fijo. Detalle: muni360-estetica.md. El rendimiento autenticado en cancha y los casos reales que requieren cuentas Google conservan su estado pendiente.


### Vista compacta solicitada por el usuario
Retirados el boton Modo cancha, su controlador y sus estilos condicionales. Vista compacta por defecto en ambos portales; cabecera y navegacion mas bajas, resumen plegado al final, referencias bajo ayuda, fichas compactas y guardado sin superposicion fija. Se ampliaron las pruebas de navegador a doce recorridos con Direccion/Profe en tres anchos por portal. Se verifica la ausencia del boton, barra administrativa vacia oculta, primer jugador visible mas arriba, resumen/ayuda y controles de 44 px. Detalle vigente: muni360-estetica.md.


### Navegacion operativa sin Cambios
A partir del video aportado por el usuario se retiro Cambios de la interfaz de Profe, Reemplazante y Consulta. Direccion y Coordinacion lo conservan. El perfil operativo habitual, sin administracion de padron, tiene cuatro pestanas fijas en una fila: Asistencia, Evaluar, Banco UGI y Analisis; no necesita desplazamiento horizontal.
Se bloquea la apertura de la vista desde su controlador de interfaz, se evita consultar auditoria desde esa vista para perfiles operativos y se limpia el contenido si cambia el rol mientras estaba abierta. No se altera el registro de las operaciones ni la politica del servidor para su auditoria.
Se corrigio tambien el perfil Profe simulado de las pruebas: la demostracion solo otorga permisos generales a su Direccion ficticia, en lugar de hacer que todos los perfiles hereden administracion. Dos regresiones verifican roles y cambio de perfil; los doce recorridos de navegador comprueban cuatro opciones visibles y alineadas sin scroll para Profe y Cambios visible para Direccion. Suite: 125 pruebas aprobadas.

### Corte a Supabase y publicación en dominio UGI — 12 de noviembre de 2026
Con confirmación explícita del propietario se verificó la importación exacta (`tools/verify-import.sql` -> `VERIFICACION_COMPLETA_OK`: 3 usuarios, 2 actividades —`Hockey sobre Patines Caballeros` y `Colonia`— y 31 recibos) y se ejecutó `tools/activate-verified.sql`, quedando la base en estado `ready`. Se publicó primero el frontend en Firebase Hosting y luego el paquete aislado bajo el dominio institucional en `https://ugiccba.com.ar/ensayo360muni/` (`/deportes/`, `/colonia/` y `/admin/`).

Comprobaciones posteriores a la publicación realizadas hasta el momento (sin sesión Google personal):
- Los 15 archivos públicos de `/ensayo360muni/` coinciden con su manifiesto SHA-256 (`npm run check:ensayo360`); Firebase Auth inicializa con opción de recordar sesión y la Edge Function de Supabase rechaza peticiones sin token con HTTP 401 / `SESION` confirmando CORS.
- La consulta privada confirmó 3 usuarios, 31 recibos, 2 actividades habilitadas, cero proyecciones pendientes a Sheets, vistas de Hockey y Colonia al día y origen anterior congelado (sin reabrir Apps Script como backend HTTP).
- Las pruebas automatizadas locales (133 generales + 35 de Supabase + recorridos con PGlite y Google simulado) pasaron, y se agregó la cola de avisos al aprobar/reactivar usuarios (`009_access_notifications.sql`), pendiente también de observar en envío real.

**Confirmación real del usuario posterior al corte (12/11/2026):** con su sesión Google real sobre `https://ugiccba.com.ar/ensayo360muni/` confirmó el primer ingreso y funcionamiento completo de los tres portales (`/deportes/`, `/admin/` y `/colonia/` con sesión recordada entre rutas sin volver a pedir login): encabezado compacto con actividad (`Hockey sobre Patines Caballeros`), nombre y rol (`Dirección UGI`), carga de padrón/asistencias/evaluaciones, apertura y guardado de nota en Legajo privado (`D02`), apoyo DUA (`D01`), guardado en Supabase + `Actualizar vistas de Sheets` sin exponer DNI ni legajo privado (`S01`), listado de los 3 usuarios con historial de permisos (`G03`) y rechazo al intentar modificar la cuenta propietaria desde Administración (`G05`).

**Verificación automatizada de interfaz en Chrome sobre `/ensayo360muni/` (12/11/2026):** para validar los flujos operativos restantes sin intervención manual del usuario, se ejecutaron las suites en Chrome headless contra el backend Supabase local (`PGlite` + `server/supabase/tests/browser-fixture.mjs`):
- Recorrido completo en Chrome (`server/supabase/tests/browser-flow.cjs`): 21 llamadas API aprobadas (`ok: true`) entre `muni360`, `muni360cyc` y `admin`, incluyendo reconexión automática tras corte de red, evaluación decimal, selección de comida en Colonia, sincronización a Sheets y rechazo de modificación sobre la cuenta propietaria.
- Recorrido específico en Chrome sobre el paquete `/ensayo360muni/deportes/` validando `A01` (fecha nueva en `-`), `A11` (advertencia ante cambios sin guardar y conservación de fecha/selección al cancelar), `E01`/`E02`/`E03` (evaluación decimal `7,5` y `8,0` separadas en análisis, persistida tras reabrir jugador, y `Sin evaluar` cuando faltan datos), `P01`/`P04` (pegado en dos renglones crea dos deportistas separados y reimportar nombre existente sin DNI conserva el DNI `12345678`) y `D03` (bitácora histórica sin controles de edición ni borrado sobre notas existentes), sin errores ni cambios necesarios en las fuentes.
- Suite estética y responsiva en Chrome (`scripts/check-muni360-ui.cjs`): 12 vistas aprobadas en anchos `360`, `390` y `1440` px para Dirección y Profe en ambos portales (`errors: 0`).

**Pendiente posterior al corte:** el resto de las casillas marcadas como `Pendiente` o `Parcial` —y la confirmación final en sesión Google real sobre `https://ugiccba.com.ar/ensayo360muni/` de los casos verificados por ahora en Chrome + PGlite— siguen abiertas hasta ejecutarse con cuentas Google reales en vivo. No se dan por cerradas a partir de simulaciones locales.
