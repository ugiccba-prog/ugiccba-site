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
| G04 | Intentar abrir administración como profe. | Sin capacidad de listar ni modificar usuarios. | Pendiente |
| G05 | Intentar modificar al propietario desde su panel. | Rechazo; no puede quitarse accidentalmente el control. | Pendiente |
| G06 | Abrir todos los equipos de una actividad autorizada. | Acceso a todos, incluyendo el equipo cubierto por reemplazo. | Parcial: acceso de profe confirmado; cobertura completa pendiente |
| G07 | Pedir otra actividad no autorizada. | Rechazo del servidor, aunque se altere la interfaz. | Pendiente |
| G08 | Suspender al profe mientras tiene la app abierta. | La siguiente petición no recibe datos ni guarda cambios nuevos. | Pendiente |
| G09 | Cambiar actividades/permisos con un pendiente de ese profe. | La carga requiere revisión con el acceso actualizado; no se reenvía a otra cuenta. | Pendiente |
| G10 | Dejar vencer un reemplazo y volver a consultar/guardar. | Acceso vencido; Dirección puede renovarlo. | Pendiente |
| G11 | Usar una cuenta de consulta. | Lectura autorizada y todas las escrituras rechazadas. | Pendiente |
| D01 | Profe consulta padrón y apoyo DUA. | Sin DNI ni bitácora privada; apoyo operativo correcto de la persona elegida. | Pendiente |
| D02 | Dirección abre legajo y agrega una nota. | Nota compartida entre sesiones autorizadas, autor real y fecha; no sólo memoria local. | Pendiente |
| D03 | Intentar modificar una nota histórica. | Se conserva; se pide una rectificación como evento nuevo. | Pendiente |
| D04 | Profe registra una tarjeta verde. | Evento propio en la bitácora; no recibe otras notas privadas en respuesta o auditoría. | Pendiente |
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
| A05 | Dos profes abren la misma fecha y guardan versiones distintas. | Se confirma la primera; la segunda requiere comparar y revisar. | Pendiente |
| A06 | Cambiar el padrón después de que otro profe abrió su lista. | La lista vieja se bloquea por cambio de plantel. | Pendiente |
| A07 | Cortar red antes de guardar y recargar la página. | Pendiente por cuenta recuperable; no muestra guardado confirmado. | Pendiente |
| A08 | Cortar respuesta después de llegar a Google y reintentar. | Un recibo y un cambio; no duplica el registro. | Pendiente |
| A09 | Respuesta perdida de una sesión UGI y usar Revisar pendiente. | Detecta que ya estaba guardada antes de generar otra operación. | Pendiente |
| A10 | Salir con pendientes y entrar con otra cuenta. | No ve ni envía pendientes de la cuenta anterior. | Pendiente |
| A11 | Cambiar grupo o fecha con asistencia sin guardar. | Advertencia; cancelar mantiene el contexto y los cambios. | Pendiente |
| E01 | Evaluar una variable, decimales y notas fuera de 1–10. | Sólo valores válidos; sin promedio técnico/formativo mezclado. | Pendiente |
| E02 | Guardar evaluación y volver a abrirla. | Mismos valores; autor y cambio presentes en historial. | Pendiente |
| E03 | Consultar análisis sin datos y con pocos datos. | Sin divisiones por cero; sin convertir ausencia de observación en buen resultado. | Pendiente |
| E04 | Exportar XLSX con permiso y sin permiso. | Archivo correcto para autorizado; bloqueo para quien no puede exportar. | Pendiente |
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
| B01 | Crear respaldo dos veces el mismo día. | Una copia confirmada; sin crecimiento duplicado por reintento normal. | Pendiente |
| B02 | Probar carpeta compartida, sin permisos o Drive sin espacio. | No declara respaldo correcto; conserva originales. | Pendiente |
| B03 | Restaurar en una copia y comparar registros posteriores al respaldo. | Recuperación documentada y conciliación; no se prometen datos posteriores a la copia. | Pendiente |
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

El usuario confirmó el autoguardado y la llegada a Sheets primero con Dirección y luego con Profe, sin pulsar Guardar ni Actualizar vistas. Esto no completa los ensayos reales de corte de red, conflicto, suspensión ni recuperación. Sus pruebas automatizadas constan en tests/muni360-resilience.test.cjs.

Para el ensayo real de recuperación, ejecutar ensayarRespaldoYRecuperacionUGI desde el editor del proyecto vinculado a la planilla nueva de ensayo. La función crea un checkpoint y copias privadas de recuperación, compara todas las tablas, introduce un cambio posterior únicamente en una copia y verifica otra recuperación al punto original. Luego comprueba la deduplicación del respaldo diario y programa una ejecución diaria a las 2 h de Buenos Aires. Conservar el registro RESPALDO_Y_RECUPERACION_VERIFICADOS. Crear el activador no verifica sus futuras ejecuciones: B04 sigue pendiente hasta observarlas. Nunca restaura sobre el original.
