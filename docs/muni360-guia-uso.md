# Muni360 — guia de uso del ensayo
Version candidata del 11 de noviembre de 2026.

## Acceso
- Deportes: https://muni360-ugi-ensayo.web.app/muni360/
- Colonia y COYFD: https://muni360-ugi-ensayo.web.app/muni360cyc/
- Usuarios y permisos: https://muni360-ugi-ensayo.web.app/admin/

Ingresar con Google y usar una cuenta aprobada. La cuenta propietaria administra accesos. Direccion y Coordinacion ven las herramientas que sus permisos habilitan. Profe ve Asistencia, Evaluar, Banco UGI y Analisis. Puede cubrir todos los equipos de cada actividad autorizada. La pagina usa horario argentino.

## Profe: una clase
1. Revisar actividad, grupo/equipo y fecha en Grupo / fecha.
2. Marcar Presente, Ausente o Tarde. El guion indica sin registrar.
3. Registrar semaforo solo cuando hubo observacion; el guion significa sin observar. Los botones tienen nombres accesibles y las referencias estan en ?.
4. En Colonia, seleccionar comida cuando corresponda. Ausente no lleva comida.
5. Esperar la confirmacion de guardado. La asistencia intenta guardarse automaticamente tras tres segundos sin nuevos cambios. Guardar asistencia, al final, permite forzar el intento.
6. Para evaluar, elegir una persona, cargar valores de 1 a 10 y usar Guardar y pasar al siguiente. Las evaluaciones necesitan ese guardado explicito. Admiten decimales.
7. Los apoyos DUA se abren desde la persona. El registro de cambios conserva el autor aunque Profe no tenga la pestana Cambios.

La asistencia y las evaluaciones pertenecen a la fecha y al grupo elegidos. Los indicadores de la clase estan al final, dentro de Resumen de la clase. Si se cambia de grupo con un borrador, revisar la advertencia antes de descartarlo.

## Que significa el estado
| Estado | Accion |
| --- | --- |
| Guardado y confirmado / vistas actualizadas | La operacion fue confirmada y la vista se verifico. |
| Guardado en Sheets privado, vistas pendientes | El original esta confirmado; la vista necesita sincronizarse. Direccion puede usar Actualizar vistas de Sheets. |
| Carga pendiente / sin confirmar | Conservar el navegador y sus datos. Reintentar con conexion; no dar la carga por guardada. |
| Otra persona modifico el registro / cambio el padron | Abrir Revisar pendiente, ver los datos actuales y decidir si corresponde reenviar o descartar. |
| Acceso pendiente, suspendido, vencido o actividad no habilitada | Consultar a Direccion. No cambiar de cuenta para intentar enviar esa misma carga. |
| Autorizacion modificada | Revisar acceso y comparar el pendiente antes de reenviar. |

## Conexion y cierre
Si se corta Internet con la pagina ya abierta, la carga queda pendiente en ese navegador y cuenta. Al recuperar conexion se reintenta. Para abrir la pagina desde cero hace falta conexion; no se promete funcionamiento completo al recargar sin red.

No borrar datos del navegador ni cambiar de dispositivo antes de resolver pendientes. Un pendiente local de una PC no aparece automaticamente en otra hasta que se confirme en el servidor. Al salir con pendientes, quedan vinculados a la cuenta que los creo. Bloquear el equipo y cerrar sesion al terminar.

## Direccion
- Aprobar solo las actividades y capacidades que correspondan; Consulta no edita y Reemplazante necesita vencimiento.
- Revisar Cambios para autor, fecha argentina y antes/despues. Una nota previa se rectifica con un nuevo evento.
- Importar con la plantilla de padron: revisar el archivo y el grupo antes de Cargar. Un nombre duplicado o DNI invalido se rechaza; reimportar el mismo nombre/grupo no debe duplicarlo.
- Exportar solo con permiso. El XLSX se descarga desde Analisis.
- Usar las planillas de actividad como vistas; para notas propias, crear otra pestana. No editar las tablas internas de control.
- Antes de cerrar una temporada o restaurar, seguir muni360-operacion.md. La restauracion se ensaya en copias, no sobre el unico respaldo.

## Presentacion
Usar datos ficticios. Se puede mostrar primero el modelo de demostracion para explicar pantallas y despues el ensayo real para demostrar guardado y Sheets.

Recorrido sugerido: Google y acceso aprobado → otro equipo de la actividad → asistencia y confirmacion → evaluacion → Direccion y Cambios → Sheets → estado del respaldo. El modelo de demostracion es ficticio y sus cambios no se envian a Google; no presentarlo como prueba del guardado real.
