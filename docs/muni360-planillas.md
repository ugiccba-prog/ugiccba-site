# Planillas de Muni360

## Control institucional

Abrir la [planilla de control](https://docs.google.com/spreadsheets/d/1s8bmpNq_4RkxKQjm2Rn2_fBqZ7aWrI8suetSSxix-uA/edit) con la cuenta propietaria institucional. Al volver a abrirla aparece el menú **Muni360**.

En **Muni360 → Crear todas las plantillas** se preparan las actividades habilitadas. Las planillas existentes conservan sus enlaces y sus datos; las que estén en la papelera se recuperan. Solo se crean destinos nuevos para actividades sin planilla registrada. Si se alcanza el límite de tiempo, otra pulsación continúa el trabajo.

La pestaña **PlantillasMuni360** reúne los enlaces por actividad y un botón **Crear todas las plantillas**. El mantenimiento institucional instala este control una sola vez; también puede abrirse desde **Muni360 → Abrir índice de planillas**.

Los registros se cargan desde la web. **CargaPadron** permite preparar nombres para revisarlos e importarlos en la app. No se vacían padrones, asistencias, evaluaciones ni historiales al pulsar el botón.

## Código vigente y limpieza

- Web y datos: el código de `main` y el backend Supabase.
- Mantenimiento Google: el proyecto vinculado a la planilla de control, con `SheetsInstitucional`, `MantenimientoOriginal` y `PlantillasMuni360`.
- Código de estos tres módulos: `server/supabase/tools/`.
- La preparación de trabajos faltantes está en `server/supabase/sql/011_sheet_templates.sql`. Solo acepta la credencial institucional existente.
- `crearRecursosDeEnsayoUGI` se bloquea cuando el ensayo ya está migrado y dirige al menú vigente.
- El control retira únicamente los activadores heredados de copia del ensayo y sincronización anterior. Conserva `tareasSupabaseUGI` y cualquier otro activador ajeno a esa lista.
- Los respaldos anteriores se conservan. No se vacía la papelera ni se borran proyectos para limpiar la lista.

## Revisión del 15/11/2026

Las 25 planillas registradas estaban en la papelera de Google Drive. El registro de destinos de Supabase seguía apuntando a ellas y no había trabajos pendientes; por eso la creación anterior no reconstruía los archivos. Se agregó recuperación de destinos y creación reanudable de los faltantes, junto con comprobaciones de propietario y proyecto.

En ambas PC la copia privada de trabajo del mantenimiento se identifica como `Projects/Muni360-Privado/apps-script-institucional`. No subir `.clasp.json`, propiedades ni archivos privados al repositorio.
