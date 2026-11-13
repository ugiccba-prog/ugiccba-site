# Muni360 — guía de uso del ensayo
Versión activa `supabase-1.0.0` · Actualizada el 12 de noviembre de 2026.

## Acceso
- Entrada unificada (recomendada): https://ugiccba.com.ar/ensayo360muni/
- Deportes: https://ugiccba.com.ar/ensayo360muni/deportes/
- Colonia y COYFD: https://ugiccba.com.ar/ensayo360muni/colonia/
- Usuarios y permisos: https://ugiccba.com.ar/ensayo360muni/admin/

> **Continuidad desde el acceso anterior:** Si habías usado https://muni360-ugi-ensayo.web.app/muni360/, verificá primero allí con tu cuenta que no hayan quedado cargas locales pendientes antes de pasar al dominio `ugiccba.com.ar`. Tus datos confirmados ya están en la misma base Supabase y al cambiar de dominio sólo iniciás sesión con Google una vez (luego rige *Mantener sesión iniciada*).

Ingresar con Google y usar una cuenta aprobada. La cuenta propietaria administra accesos. Dirección y Coordinación ven las herramientas que sus permisos habilitan. Profe ve Asistencia, Evaluar, Banco UGI y Análisis. Puede cubrir todos los equipos de cada actividad autorizada. La página usa horario argentino.

## Profe: una clase
1. Revisar actividad, grupo/equipo y fecha en Grupo / fecha.
2. Marcar Presente, Ausente o Tarde. El guion indica sin registrar.
3. Registrar semaforo solo cuando hubo observacion; el guion significa sin observar. Los botones tienen nombres accesibles y las referencias estan en ?.
4. En Colonia, seleccionar comida cuando corresponda. Ausente no lleva comida.
5. Esperar la confirmacion de guardado. La asistencia intenta guardarse automaticamente tras tres segundos sin nuevos cambios. Guardar asistencia, al final, permite forzar el intento.
6. Para evaluar, elegir una persona, cargar valores de 1 a 10 y usar Guardar y pasar al siguiente. Las evaluaciones necesitan ese guardado explicito. Admiten decimales.
7. Los apoyos DUA se abren desde la persona. El registro de cambios conserva el autor aunque Profe no tenga la pestana Cambios.

La asistencia y las evaluaciones pertenecen a la fecha y al grupo elegidos. Los indicadores de la clase estan al final, dentro de Resumen de la clase. Si se cambia de grupo con un borrador, revisar la advertencia antes de descartarlo.

## Qué significa el estado
| Estado | Acción |
| --- | --- |
| Guardado en la base / vistas actualizadas | La operación se confirmó en Supabase y la vista en Google Sheets está al día. |
| Guardado en la base, proyección a Sheets pendiente | El original está confirmado en Supabase; el trabajador de Apps Script proyecta a Google Sheets cada 5 minutos (o Dirección puede usar *Actualizar vistas de Sheets*). |
| Carga pendiente / sin confirmar | Conservar el navegador y sus datos. Reintentar con conexión; no dar la carga por guardada. |
| Otra persona modificó el registro / cambió el padrón | Abrir *Revisar pendiente*, ver los datos actuales y decidir si corresponde reenviar o descartar. |
| Acceso pendiente, suspendido, vencido o actividad no habilitada | Consultar a Dirección. No cambiar de cuenta para intentar enviar esa misma carga. |
| Autorización modificada | Revisar acceso y comparar el pendiente antes de reenviar. |

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
