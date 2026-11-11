# Muni360 · Matriz de aceptación en Google

Versión candidata `apps-script-3.0.0` · El estado de los ensayos reales se actualiza únicamente con evidencia de Google o confirmación del usuario. Las pruebas locales automáticas no completan estas casillas. Usar datos ficticios y planillas de ensayo.

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
| G03 | Aprobar desde la cuenta propietaria. | El profe entra al revisar acceso; alta de permiso con autor, antes y después. | Parcial: ingreso aprobado; historial de permiso pendiente |
| G04 | Intentar abrir administración como profe. | Sin capacidad de listar ni modificar usuarios. | Confirmado por usuario: enlace directo rechazado; sin lista de usuarios |
| G05 | Intentar modificar al propietario desde su panel. | Rechazo; no puede quitarse accidentalmente el control. | Pendiente |
| G06 | Abrir todos los equipos de una actividad autorizada. | Acceso a todos, incluyendo el equipo cubierto por reemplazo. | Parcial: acceso de profe confirmado; cobertura completa pendiente |
| G07 | Pedir otra actividad no autorizada. | Rechazo del servidor, aunque se altere la interfaz. | Parcial real: Colonia retirada rechaza escritura; continuidad de Hockey corregida, repetir |
| G08 | Suspender al profe mientras tiene la app abierta. | La siguiente petición no recibe datos ni guarda cambios nuevos. | Parcial real: envío suspendido rechazado; lectura pendiente |
| G09 | Cambiar actividades/permisos con un pendiente de ese profe. | La carga requiere revisión con el acceso actualizado; no se reenvía a otra cuenta. | Parcial real: reactivación y revisión del pendiente confirmadas |
| G10 | Dejar vencer un reemplazo y volver a consultar/guardar. | Acceso vencido; Dirección puede renovarlo. | Parcial real: vencimiento rechaza y renovación recupera; guardado previo al vencimiento por confirmar |
| G11 | Usar una cuenta de consulta. | Lectura autorizada y todas las escrituras rechazadas. | Confirmado por usuario: lectura y navegación disponibles, controles de escritura bloqueados |
| D01 | Profe consulta padrón y apoyo DUA. | Sin DNI ni bitácora privada; apoyo operativo correcto de la persona elegida. | Parcial real: Padrón oculto y nota privada ausente en Cambios; apoyo DUA pendiente |
| D02 | Dirección abre legajo y agrega una nota. | Nota compartida entre sesiones autorizadas, autor real y fecha; no sólo memoria local. | Pendiente |
| D03 | Intentar modificar una nota histórica. | Se conserva; se pide una rectificación como evento nuevo. | Pendiente |
| D04 | Profe registra una tarjeta verde. | Evento propio en la bitácora; no recibe otras notas privadas en respuesta o auditoría. | Confirmado por usuario: reconocimiento con autor y nota privada conservada |
| D05 | Mismo DNI/persona en dos actividades. | Identidad estable; no mezcla el contexto privado de las actividades. | Pendiente |
| D06 | Corregir DNI y tratar de reutilizar el anterior para otra persona. | ID estable y conflicto para revisar el DNI reservado; sin herencia silenciosa de ficha. | Pendiente |
| P01 | Pegar dos renglones de nombres y cargar en un grupo. | Dos deportistas; no se concatenan los renglones. | Parcial: dos jugadores; entrada por renglones pendiente |
| P02 | Importar Apellido/Nombre/DNI con acentos y ceros vacíos. | Vista previa correcta; no adivina categorías ni sustituye DNI por otra cifra. | Pendiente |
| P03 | Importar nombre repetido, DNI inválido, más de 500 filas o más de 2 MB. | Mensaje claro y ninguna carga parcial. | Pendiente |
| P04 | Reimportar un nombre existente sin DNI. | Conserva DNI e identidad. | Pendiente |
| P05 | Preparar nombres en CargaPadron y revisarlos en la app. | Se confirma el grupo de destino y se registra la persona que importó. | Pendiente |
| A01 | Abrir fecha nueva sin asistencia. | Sin registrar y sin observar; no inventa presentes ni verdes. | Pendiente |
| A02 | Guardar P/A/T, semáforos y comida en Colonia. | Datos correctos al recargar; comida sólo según la selección realizada. | Parcial: asistencia y semáforo; comida pendiente |
| A03 | Guardar fecha inválida o un alumno fuera del grupo. | Rechazo sin cambiar datos/versiones. | Pendiente |
| A04 | Doble toque rápido en Guardar. | Una operación en curso; sin dos eventos involuntarios. | Pendiente |
| A05 | Dos profes abren la misma fecha y guardan versiones distintas. | Se confirma la primera; la segunda requiere comparar y revisar. | Parcial real: conflicto bloqueado y dato anterior visible; cierre del pendiente por confirmar |
| A06 | Cambiar el padrón después de que otro profe abrió su lista. | La lista vieja se bloquea por cambio de plantel. | Pendiente |
| A07 | Cortar red antes de guardar y recargar la página. | Pendiente por cuenta recuperable; no muestra guardado confirmado. | Parcial real: corte y reconexión automática confirmados; recarga sin red pendiente |
| A08 | Cortar respuesta después de llegar a Google y reintentar. | Un recibo y un cambio; no duplica el registro. | Pendiente |
| A09 | Respuesta perdida de una sesión UGI y usar Revisar pendiente. | Detecta que ya estaba guardada antes de generar otra operación. | Pendiente |
| A10 | Salir con pendientes y entrar con otra cuenta. | No ve ni envía pendientes de la cuenta anterior. | Pendiente |
| A11 | Cambiar grupo o fecha con asistencia sin guardar. | Advertencia; cancelar mantiene el contexto y los cambios. | Pendiente |
| E01 | Evaluar una variable, decimales y notas fuera de 1–10. | Sólo valores válidos; sin promedio técnico/formativo mezclado. | Pendiente |
| E02 | Guardar evaluación y volver a abrirla. | Mismos valores; autor y cambio presentes en historial. | Parcial real: evaluación decimal recuperada tras conflicto; reapertura en ambas cuentas pendiente |
| E03 | Consultar análisis sin datos y con pocos datos. | Sin divisiones por cero; sin convertir ausencia de observación en buen resultado. | Pendiente |
| E04 | Exportar XLSX con permiso y sin permiso. | Archivo correcto para autorizado; bloqueo para quien no puede exportar. | Confirmado por usuario: XLSX correcto y descarga sin permiso rechazada |
| H01 | Consultar Cambios como profe y como Dirección. | Alcance correcto, autor, fecha y antes/después de cada operación. | Parcial: autor en Sheets; alcance completo pendiente |
| H02 | Registrar una sesión y contrastar el autor enviado por el navegador. | Se usa el usuario autenticado, no un autor escrito libremente. | Pendiente |
| S01 | Guardar y pulsar Actualizar vistas de Sheets desde Dirección. | Original, vista y EstadoSync consistentes. | Verificado en Google y confirmado por usuario |
| S02 | Hacer fallar el destino de la vista. | Original confirmado y vista pendiente; reintento sin pérdida. | Pendiente |
| S03 | Hacer fallar el original privado. | No se confirma la carga ni aparecen datos/auditoría parciales. | Pendiente |
| S04 | Agregar una pestaña propia y sincronizar. | La pestaña propia se conserva; las vistas operativas se actualizan. | Pendiente |
| S05 | Editar manualmente una tabla original con estado ya confirmado. | Nuevas cargas bloqueadas por discrepancia para revisión. | Pendiente |
| S06 | Probar filas que comienzan por =, +, - o @. | Texto literal en Sheets y XLSX; no se ejecutan fórmulas de entrada. | Pendiente |
| T01 | Archivar temporada conservando padrón. | Historial recuperable; nueva asistencia/evaluación vacía y padrón conservado. | Pendiente |
| T02 | Archivar con padrón vacío nuevo y revisar una ficha anterior. | Copia histórica y legajos preservados según acceso. | Pendiente |
| T03 | Intentar archivar con pendientes o enviar un pendiente de temporada vieja. | Se bloquea; no mezcla ciclos. | Pendiente |
| T04 | Interrumpir un cierre de temporada. | Todo aplicado o todo intacto; recuperar el mismo recibo si se perdió la respuesta. | Pendiente |
| B01 | Crear respaldo dos veces el mismo día. | Una copia confirmada; sin crecimiento duplicado por reintento normal. | Verificado en Google: copia diaria sin duplicado |
| B02 | Probar carpeta compartida, sin permisos o Drive sin espacio. | No declara respaldo correcto; conserva originales. | Pendiente |
| B03 | Restaurar en una copia y comparar registros posteriores al respaldo. | Recuperación documentada y conciliación; no se prometen datos posteriores a la copia. | Verificado en Google: recuperación exacta y cambio posterior excluido |
| B04 | Verificar activadores durante varios días. | Ejecuciones verificables, vistas al día y respaldo real; no sólo activador creado. | Pendiente |
| V01 | Simular el pico real de profes y planteles. | Medir latencia mediana/p95, errores y cuotas; sin pérdida ni duplicación. | Pendiente |
| V02 | Probar 500 personas y volumen de una temporada. | Confirmar rendimiento real, tamaño, cierre e historial, sin habilitar facturación. | Pendiente |
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
