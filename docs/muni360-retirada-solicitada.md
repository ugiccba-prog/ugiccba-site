# Retirada solicitada del ensayo de 16 semanas

El 19/11/2026 el propietario pidió quitar las cargas ficticias y conservar las herramientas preparadas. Esta solicitud reemplaza la intención de mantener la demostración compartida. No volver a cargar el catálogo sintético ni iniciar nuevas pruebas en la base publicada.

## Estado comprobado de esta solicitud

Retirada ejecutada el 19/11/2026, después de recuperar la conexión con Chrome y recibir la confirmación final del propietario. La comprobación previa encontró los 22425 documentos del ensayo activos, sin modificaciones, y cero documentos anteriores modificados. Se ejecutó el procedimiento selectivo probado, conservando sus verificaciones y la copia privada.

La comprobación posterior confirmó `status=retired`, **cero documentos del ensayo en operación y cero documentos anteriores modificados**. Los 22425 documentos permanecen únicamente en el manifiesto privado para trazabilidad/recuperación administrativa; no se borraron los registros anteriores ni las herramientas. No se purgó la copia privada.

Se completó la actualización de las vistas con `sincronizarMuni360SupabaseOriginalUGI`, usando la cuenta institucional y sin ejecutar el envío de avisos. Cuatro lotes confirmaron cinco actividades cada uno; el último confirmó dos. Un intento intermedio encontró la cuota temporal de lecturas de Google Sheets y se reintentó después de transcurrir el intervalo, sin cambiar las cuotas ni el código publicado.

La verificación final, posterior al lote de las 20:48, devolvió `retired / 22425 / 0 / 0 / 0 / 0`: manifiesto privado conservado, cero documentos del ensayo activos, cero documentos de prueba modificados, cero documentos anteriores modificados y **cero actividades pendientes de copiar a Sheets**. Se abrió la planilla oficial de Básquet Damas y se comprobó visualmente su pestaña `Padron`, con los encabezados y sin filas de prueba. La captura quedó como evidencia local. El ingreso adicional a Muni360 no se completó porque la selección de cuenta Google agotó el tiempo de espera; la limpieza de su fuente operativa sí se verificó directamente en la base.

Las herramientas y los cambios preparados permanecen conservados; `main` y el código de producción no se modificaron. El parche de rendimiento sigue disponible para revisión futura: la limpieza permitió sincronizar las vistas con el trabajador existente, sin aplicar ese parche.

## Alcance de la retirada

- Lote `ensayo-16s-20261119`: 345 grupos, 2760 inscripciones, 88320 asistencias y 11040 evaluaciones sintéticas, identificadas por su manifiesto privado. Los conteos son los de la carga original; deben verificarse nuevamente antes de retirar.
- Mantener los registros anteriores, las cuentas, sus permisos y las herramientas existentes. Conservar las correcciones preparadas en la rama de desarrollo. Las alertas nuevas y el escalamiento de Inteligencia siguen pendientes de implementación; esta retirada no los convierte en funciones terminadas.
- Conservar el manifiesto privado y la copia anterior para conciliación y trazabilidad. No borrar tablas completas, carpetas oficiales ni reiniciar temporadas.
- Verificar las vistas de Sheets después de retirar. No asumir que nunca recibieron filas de prueba sólo porque fallaban anteriormente.

## Procedimiento preparado

1. Ejecutar `server/supabase/tools/demo-shared-status.sql`, de sólo lectura.
2. Revisar cambios posteriores y registros nuevos del ensayo. `demo-shared-retire.sql` detiene la operación si los detecta; no desactivar sus verificaciones para forzar la limpieza.
3. Ejecutar la retirada selectiva preparada cuando esté disponible el acceso autorizado. El contenido del manifiesto queda retenido en privado y los documentos dejan de estar en la operación.
4. Repetir la consulta de estado: lote `retired`, cero documentos del manifiesto en operación y cero documentos anteriores modificados.
5. Verificar en la aplicación la ausencia de los grupos del lote, y confirmar la copia actualizada de cada actividad a Sheets. Si alguna vista conserva filas del ensayo, conciliarlas y actualizarla sin borrar datos previos.

No modificar `main` ni desplegar cambios de interfaz para quitar los datos: los registros cargados residen en Supabase. El parche de rendimiento de la sincronización sigue preparado en `server/supabase/tools/optimize-worker-jobs.sql`; la autorización anterior no equivale a una aplicación realizada.
