# Avisos y gestión de accesos en Muni360

## Alta directa por correo

En [Usuarios y permisos](https://ugiccba.com.ar/muni360/admin/), Dirección UGI puede usar **Agregar acceso**, asignar un rol, actividades y vencimiento cuando corresponda, y pulsar **Habilitar acceso y enviar correo**. El correo entra en la cola institucional. Al ingresar con la cuenta de Google verificada para esa dirección, la persona recibe los permisos asignados.

El panel informa si el correo está en cola, enviándose, enviado o pendiente de revisión. La autorización se guarda antes de que el trabajador procese el correo. Se verificaron la cola y la vinculación del primer ingreso con datos de prueba. Queda pendiente confirmar la entrega a una casilla real.

## Archivo de accesos

**Archivar acceso** está disponible para Dirección sobre registros pendientes, suspendidos o vencidos. Para retirar un acceso vigente, primero suspendelo. El filtro **Archivados** permite **Restaurar** un registro como suspendido. El **Historial de permisos** conserva el motivo, la fecha, el autor, la cuenta afectada y sus valores antes y después. Para volver a habilitar el ingreso, cambiá el estado en una edición posterior. Publicado el 24/11/2026.

## Antecedente del ensayo Apps Script

Se ejecutan en Apps Script con MailApp. Destinatario: correo de la cuenta autenticada cuyo UID coincide con UGI_OWNER_UID; nunca un correo enviado por el solicitante. No cambian roles ni permisos.

## Activación

Desde el proyecto de ensayo, ejecutar activarAvisosAccesoUGI con la cuenta propietaria y aceptar el alcance script.send_mail. Se crea un único activador de cinco minutos y se procesan las solicitudes pendientes actuales. No requiere cambiar la URL ni la versión publicada del portal: el activador lee UsuariosUGI.

Hasta activar, no se envían avisos. La activación registra AVISOS_ACCESO_ACTIVADOS. No registrar correos ni contenido en los logs.

## Límites y entrega

Máximo diez solicitudes por ejecución y limitado por la cuota restante de MailApp. Sin cuota, las pendientes esperan otra ejecución. Cuentas activadas o suspendidas se excluyen. Solo se reserva y envía una vez por cuenta pendiente. El correo contiene nombre, email y enlace fijo al panel; no incluye datos de deportistas ni tokens.

Se reserva avisoAcceso.estado=enviando en Sheets antes de enviar, bajo el mismo bloqueo global que usan las cargas. Entrega confirmada: enviado. Error o respuesta ambigua: revisar; no se reenvía automáticamente, para evitar duplicados. Si el proceso se interrumpe después de reservar, permanece enviando. Dirección debe verificar la entrega antes de un eventual reenvío manual. La solicitud permanece visible y autorizable aunque el correo falle. No se modifica la revisión de permisos.

## Validación

Ocho pruebas nuevas cubren destinatario, repetición, cuota, fallos de Sheets, envío ambiguo, autorización previa, bloqueo y activación idempotente. Suite completa: 133 pruebas aprobadas. El envío real y el consentimiento de Google quedan pendientes hasta la activación por la cuenta propietaria.
