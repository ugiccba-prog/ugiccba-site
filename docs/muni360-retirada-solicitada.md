# Retirada solicitada del ensayo de 16 semanas

El 19/11/2026 el propietario pidió quitar las cargas ficticias y conservar las herramientas preparadas. Esta solicitud reemplaza la intención de mantener la demostración compartida. No volver a cargar el catálogo sintético ni iniciar nuevas pruebas en la base publicada.

## Estado comprobado de esta solicitud

Retirada pendiente de ejecución. Chrome no respondió al intento de abrir el editor de Supabase: la conexión de control agotó su tiempo de espera. No se ejecutó SQL remoto ni se declaró que los datos ya estuvieran retirados. Se solicitó reconectar Chrome para continuar.

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
