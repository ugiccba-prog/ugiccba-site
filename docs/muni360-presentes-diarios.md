# Presentes diarios de Colonia y COYFD

Dirección UGI y Coordinación ven un indicador plegado al ingresar, si tienen Colonia o COYFD entre sus actividades autorizadas. La fecha inicial es hoy en Buenos Aires. Se puede elegir otra fecha, volver a Hoy o actualizar. El panel se abre y se cierra desde su título y muestra sólo el total por actividad y por grupo. El panel histórico existente conserva sus porcentajes y períodos.

Los datos se consultan en el servidor mediante `/api/dashboard` con `daily: true` y una fecha ISO válida. Se conservan los controles de rol, actividades, estado y vencimiento de permisos. La respuesta sólo contiene agregados; no incluye nombres, DNI ni identificadores personales. No hay migraciones ni escrituras en padrones o asistencias.

- P y T cuentan como presentes; tardes es un subconjunto de presentes. A es ausencia confirmada. N, semáforo sin asistencia y falta de carga no equivalen a ausencia.
- Cada identidad se cuenta una vez por actividad y una vez por grupo. Se utiliza jugadorId y, para registros antiguos, su correspondencia con el padrón por nombre y grupo. Sin identidad disponible, se utiliza el nombre normalizado dentro del grupo: no se fusionan homónimos de grupos distintos por su nombre solamente.
- No se suman Colonia y COYFD en un total de personas; una misma persona puede participar en ambas actividades. Los totales de grupos tampoco se suman para obtener el total único de la actividad.
- Marcas contradictorias de una persona en un mismo grupo se señalan como conflicto y se excluyen del conteo confirmado de ese grupo. Una presencia confirmada en otro grupo acredita presencia en la actividad.
- Sin registros válidos se muestra “Sin registros”, incluso en grupos sin carga. Si todos tienen A se muestra cero presentes confirmado. Las cargas parciales se advierten. Las personas sin registrar se comparan con el padrón actual; no se reconstruye un padrón histórico inexistente. Se incluyen asistencias históricas aunque la persona ya no figure en el padrón actual.
- Cambiar de fecha elimina inmediatamente el resultado anterior. Respuestas atrasadas y respuestas de sesiones cerradas no vuelven a pintar datos. Un error de red no se presenta como cero.
- El indicador se actualiza después de un guardado confirmado en la página. Las cargas de otros dispositivos requieren pulsar Actualizar presentes. Los borradores locales no se incluyen.

El aviso “Asistencia guardada.” desaparece a los cuatro segundos en Deportes, Colonia y COYFD. Un nuevo borrador, error o pendiente no se oculta con ese temporizador.

Validación: 190 pruebas generales previas más cuatro de interfaz diaria; 82 pruebas del servidor, incluidas ocho específicas del conteo y autorización. Se repitieron las pruebas de formulario y navegación tras agregar la limpieza al cerrar sesión. Paquete público reproducible verificado. El navegador de pruebas no pudo iniciarse por falta de su ejecutable y la vista previa del navegador integrado no pudo acceder al servidor local; no se afirma validación visual ni ingreso institucional autenticado.
