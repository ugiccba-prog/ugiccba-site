# Planillas y Estructura en Google Drive — Muni 360

## Mapa oficial en Google Drive (`Club / Muni360`)

La operación oficial de Muni 360 se encuentra centralizada en la carpeta compartida `Club / Muni360` (`1lNUz_Hyefp8rTJT7WdaboPYaDR42qbrH`), perteneciente a la cuenta institucional `ugiccba@gmail.com`:

- **Planilla Madre de Control:** [Muni360 · Planilla Madre de Control (Oficial)](https://docs.google.com/spreadsheets/d/1s8bmpNq_4RkxKQjm2Rn2_fBqZ7aWrI8suetSSxix-uA/edit) (`1s8bmpNq_4RkxKQjm2Rn2_fBqZ7aWrI8suetSSxix-uA`), ubicada en la raíz de `Club / Muni360`.
- **Proyecto Apps Script Oficial (vinculado a la Planilla Madre):** `11B4Nfn84rYQU51pSzz0W1L9U3Z7XStXFH69Gt9obNZO-eFgY8Z5CFkZP` ([abrir editor](https://script.google.com/home/projects/11B4Nfn84rYQU51pSzz0W1L9U3Z7XStXFH69Gt9obNZO-eFgY8Z5CFkZP/edit)). Ejecuta `enviarAvisosAccesoUGI` / `tareasSupabaseUGI` cada 5 minutos.
- **`01 · Planillas por Actividad (Oficiales)`** (`1nVmfokmq_DN4T-3o6xLX3r_saGO-W3Ai`): contiene las 25 planillas activas `Muni360 - Supabase - <Actividad>` espejadas automáticamente desde Supabase y utilizadas para consulta y carga previa en `CargaPadron`.
- **`02 · Respaldos Privados Supabase (No borrar)`** (`1t89NTKaN33A-BeHv8rFMeTmv8dpbYpyg`): carpeta privada de la cuenta institucional donde el trabajador guarda una copia diaria comprimida (`Muni360-Supabase-YYYY-MM-DD.json.gz`).
- **`99 · PARA ELIMINAR (Archivos Viejos y Pruebas)`** (`1VSTrDxDsUYsb-EJjFr7gP7past4YTpUI`): carpeta de archivo que reúne prototipos previos, copias obsoletas pre-Supabase, scripts retirados y el duplicado vacío, lista para su revisión o eliminación segura cuando lo disponga Dirección.

## Control institucional

Abrir `Muni360 · Planilla Madre de Control (Oficial)` ([Planilla de control](https://docs.google.com/spreadsheets/d/1s8bmpNq_4RkxKQjm2Rn2_fBqZ7aWrI8suetSSxix-uA/edit)) con la cuenta propietaria institucional. Al volver a abrirla aparece el menú **Muni360**.

En **Muni360 → Crear todas las plantillas** se preparan las actividades habilitadas. Las planillas existentes conservan sus enlaces y sus datos; las que estén en la papelera se recuperan. Solo se crean destinos nuevos para actividades sin planilla registrada. Si se alcanza el límite de tiempo, otra pulsación continúa el trabajo.

La pestaña **PlantillasMuni360** reúne los enlaces por actividad y un botón **Crear todas las plantillas**. El mantenimiento institucional instala este control una sola vez; también puede abrirse desde **Muni360 → Abrir índice de planillas**.

Los registros se cargan desde la web. **CargaPadron** permite preparar nombres para revisarlos e importarlos en la app. No se vacían padrones, asistencias, evaluaciones ni historiales al pulsar el botón.

## Código vigente y limpieza

- Web y datos: el código de `main` (`https://ugiccba.com.ar/muni360/`) y el backend Supabase (`supabase-1.0.0`).
- Mantenimiento Google: el proyecto vinculado a la planilla de control (`11B4Nfn84rYQU51pSzz0W1L9U3Z7XStXFH69Gt9obNZO-eFgY8Z5CFkZP`), que mantiene sus módulos base junto con `SheetsInstitucional`, `MantenimientoOriginal` y `PlantillasMuni360`.
- Código de los tres módulos institucionales de Supabase/Drive: `server/supabase/tools/`.
- La preparación de trabajos faltantes está en `server/supabase/sql/011_sheet_templates.sql`. Solo acepta la credencial institucional existente.
- `crearRecursosDeEnsayoUGI` se bloquea cuando el ensayo ya está migrado y dirige al menú vigente.
- El control retira únicamente los activadores heredados de copia del ensayo y sincronización anterior. Conserva `tareasSupabaseUGI` y cualquier otro activador ajeno a esa lista.
- El script histórico `muni360` v1/v2 (`16szj2cvEW2AeTFc72n5Acp_OXZmHeAoDHxCxSBcBi9OjilbgDQb4U30P`) quedó retirado con autolimpieza de su activador semanal y guardado dentro de `99 · PARA ELIMINAR (Archivos Viejos y Pruebas)`.
- Los respaldos diarios en `MantenimientoOriginal.gs` pasan explícitamente el nombre `Muni360-Supabase-YYYY-MM-DD.json.gz` a `Utilities.gzip(...)` para evitar que Drive los guarde genéricamente como `archive.gz`.
- Los respaldos anteriores se conservan. No se vacía la papelera ni se borran proyectos automáticamente; todo elemento descartable queda aislado en `99 · PARA ELIMINAR (Archivos Viejos y Pruebas)`.

## Revisión del 15/11/2026

Las 25 planillas registradas estaban en la papelera de Google Drive y luego sueltas en la raíz de `[Mi unidad]`. El registro de destinos de Supabase seguía apuntando a ellas y no había trabajos pendientes; por eso la creación anterior no reconstruía los archivos. Se agregó recuperación de destinos y creación reanudable de los faltantes, se corrigió el nombrado `.json.gz` de los respaldos diarios, se retiró el script v1/v2 que aún disparaba copias semanales obsoletas y se organizó toda la estructura en `Club / Muni360`.

En las copias locales de mantenimiento el proyecto se identifica en `Projects/Muni360-Privado/apps-script-institucional`. No subir `.clasp.json`, propiedades ni archivos privados al repositorio.
