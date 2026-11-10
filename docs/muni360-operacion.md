# Muni360 · Instalación y ensayo paso a paso

Versión candidata `apps-script-3.0.0` · 10/11/2026.

**Primero un entorno de ensayo separado. No reemplazar el script ni las planillas actuales siguiendo una parte suelta de esta guía.** Todos los pasos de configuración de Google de este documento siguen pendientes. Se necesita la cuenta institucional que será propietaria del proyecto, sus planillas y sus respaldos.

## 1. Inventario y copia inicial

1. Identificar la cuenta propietaria del Apps Script existente y todas sus implementaciones activas. Conservar el código original, su versión, URL y lista de activadores. Guardar también el commit actual del sitio.
2. Duplicar todas las planillas actuales y comprobar que las copias tengan las mismas pestañas y cantidades de filas. Aunque todavía no se use la app, no asumir que están vacías.
3. Crear un proyecto nuevo de Apps Script para **ensayo**. No reutilizar el proyecto publicado para el club.
4. Crear en Mi unidad una planilla **Muni360 · Originales privados · Ensayo**, sin lectores ni editores adicionales, y una carpeta privada **Muni360 · Respaldos · Ensayo**.
5. Crear una planilla de actividad **vacía y separada** para Hockey sobre Patines Caballeros. Para la primera prueba alcanza una actividad. Agregar otra para probar la separación de permisos y Colonia/COYFD cuando se ensayen esos portales.
6. No usar como destinos las planillas que contienen el padrón original. Una sincronización reemplaza las pestañas operativas de su destino. Los originales anteriores quedan conservados como fuentes y copias de seguridad.

Resultado: originales anteriores intactos, planilla privada nueva, carpeta privada y vistas nuevas de ensayo.

## 2. Google sin habilitar facturación

1. Crear o seleccionar un proyecto Firebase **Spark**, sin vincular una cuenta de Cloud Billing. No activar Blaze, Cloud Run, Firestore, SMS ni servicios pagos.
2. En Authentication, habilitar únicamente el proveedor **Google** para este acceso. Elegir el correo institucional de soporte.
3. Registrar una aplicación web. Copiar su configuración pública: `apiKey`, `authDomain`, `projectId`, `appId`.
4. En dominios autorizados de Authentication, incorporar el dominio exacto que servirá el entorno de ensayo y el dominio final cuando corresponda. Si se usa un dominio nuevo, revisar también la configuración OAuth asociada. No asumir que el acceso desde un archivo `file://` funcionará.
5. Crear el primer usuario entrando con Google desde la app configurada. Antes de su aprobación aparecerá pendiente o la configuración del propietario faltará; tomar el **UID** desde Authentication → Users. Ese UID es el identificador que se configura como propietario; no se deduce del correo ni se acepta desde un formulario.
6. Para Apps Script se usa la API oficial `accounts:lookup` con el ID token. Si la API key web tiene restricción de referentes HTTP, usar otra key del **mismo proyecto**, restringida a Identity Toolkit API y apta para una llamada de servidor. Las IP de Apps Script no son una IP fija propia. No relajar las reglas de datos para resolver un error de key. Las claves de API de Firebase identifican el proyecto: no reemplazan la autenticación ni los permisos.
7. Verificar en la consola que el proyecto continúe en Spark y sin facturación asociada.

El alta inicial de Authentication puede completarse antes de conectar el backend: Google crea el usuario; el backend no asigna permisos por ese hecho.

## 3. Archivos exactos de Apps Script

Crear **sólo estos archivos de la carpeta `apps-script/`** en el proyecto nuevo:

| Archivo | Función |
| --- | --- |
| `Muni360Domain.gs` | Validación y reglas de permisos. Archivo generado; copiar tal cual. |
| `Muni360Store.gs` | Lectura, escritura atómica, recibos e identidades. |
| `Muni360Core.gs` | Entrada HTTP, validación de Google, usuarios y operaciones. |
| `DeportesUGI.gs` | Vistas, diagnóstico, respaldos y activadores. |
| `appsscript.json` | Motor V8, zona horaria y permisos del proyecto. |

No copiar `archive/apps-script-v2/`. No mezclar funciones `doGet`/`doPost` de dos versiones. No instalar el servidor `server/muni360/` ni desplegar su Dockerfile.

Mostrar el archivo de manifiesto desde la configuración del editor. Agregar **Google Sheets API v4** en Servicios avanzados. Si el proyecto usa un proyecto estándar de Google Cloud, habilitar también Sheets API allí, sin vincular facturación. El manifiesto incluido ya declara ese servicio.

Los alcances incluyen Sheets, solicitudes externas, Drive y administración de activadores. Drive se usa para las copias; no se solicita enviar correo. La cuenta que autoriza debe ser la propietaria institucional elegida.

## 4. Propiedades del script

Configurar en Configuración del proyecto → Propiedades del script:

| Propiedad | Valor |
| --- | --- |
| `UGI_DATA_SHEET_ID` | ID de la nueva planilla privada. |
| `UGI_OWNER_UID` | UID exacto de la cuenta de Juan en Authentication. |
| `UGI_FIREBASE_PROJECT_ID` | `projectId` del proyecto Spark. |
| `UGI_FIREBASE_API_KEY` | API key del mismo proyecto, válida para `accounts:lookup` desde Apps Script. |
| `UGI_SHEET_MAP` | Objeto JSON: nombre exacto de actividad → ID de su planilla nueva de consulta. |
| `UGI_BACKUP_FOLDER_ID` | ID de la carpeta privada de respaldos. |

Ejemplo de `UGI_SHEET_MAP` para un piloto de dos actividades:

```json
{"Hockey sobre Patines Caballeros":"ID_PLANILLA_NUEVA_PATINES","Colonia":"ID_PLANILLA_NUEVA_COLONIA"}
```

No incluir `UGI_DATA_SHEET_ID` como destino de una actividad ni repetir un ID para dos actividades. Las 25 actividades se agregan cuando el piloto pase las pruebas.

Cuando ya esté disponible el UID del propietario, ejecutar desde el editor **`prepararEntornoUGI()`** y autorizar los servicios. Si es el primer ingreso al proyecto Firebase y todavía no hay UID, completar primero la publicación de ensayo y el ingreso inicial del paso 5; el backend rechazará datos mientras falte esta configuración, pero Google podrá crear la identidad. Luego copiar su UID desde Authentication, completar la propiedad y volver a este punto. La función genera `UGI_ID_SECRET` si falta, verifica que los originales y la carpeta sean privados y crea el índice. Conservar ese secreto durante toda la vida del sistema; no publicarlo ni regenerarlo al actualizar código. Respaldar las propiedades de manera privada: las copias de la planilla no incluyen las propiedades del script.

Si la función falla, resolver la causa antes de continuar. No existe una contraseña universal ni un usuario/clave alternativo que permita saltear la validación.

## 5. Publicación de ensayo

1. Apps Script → Implementar → Nueva implementación → Aplicación web.
2. Ejecutar como la cuenta propietaria del script. El backend debe poder acceder a sus originales privados sin dar acceso directo a los profes.
3. Para que el navegador llame al endpoint desde el sitio, la implementación necesita permitir solicitudes anónimas al endpoint; **los datos siguen exigiendo un ID token de Google válido y permisos de la app**. Si la política institucional impide ese tipo de implementación, detener aquí y revisar el despliegue: no convertir las planillas en públicas.
4. Copiar la URL terminada en `/exec`, sin parámetros ni `/api/operations` agregado. No usar la URL `/dev` del editor.
5. En `assets/scripts/muni360-config.js`, poner `backend: 'apps-script'`, esa URL y la configuración pública de Firebase. No copiar el secreto de identidades, credenciales de servicio ni las propiedades privadas al sitio.
6. Servir el sitio por HTTPS en el dominio de ensayo autorizado. No usar `file://`.
7. Si todavía no existe el usuario de Google en Authentication, intentar primero el ingreso desde esta app: el proveedor Google crea la identidad aunque la consulta al backend indique configuración incompleta. Copiar entonces su UID, completar `UGI_OWNER_UID`, ejecutar `prepararEntornoUGI()` y usar Revisar acceso. Ingresar con la cuenta cuyo UID está configurado. Revisar `Usuarios y permisos`: esa cuenta debe administrar accesos. Una segunda cuenta debe quedar pendiente.
8. Abrir el navegador de un profe, aprobarlo desde la cuenta propietaria y usar **Ya me autorizaron · Revisar acceso**. Verificar los equipos disponibles y la ausencia de DNI y bitácoras privadas.

El transporte usa un POST `text/plain` con JSON, token en el cuerpo y sin encabezado Authorization para evitar un preflight incompatible con Apps Script. Nunca usa `no-cors` ni confirma una respuesta ilegible. **La lectura real de la respuesta y su redirección de Google se deben probar en Chrome Android y en los navegadores de PC previstos. Aún no se han probado contra una implementación de Google de este proyecto.**

## 6. Padrón inicial y datos anteriores

Para una temporada que aún no comenzó, cargar primero **datos ficticios** de 2 grupos y 2 equipos. Se puede pegar una persona por renglón o importar Excel/CSV con encabezados `Apellido`, `Nombre`, `DNI`, o `Jugador` y `DNI` opcional. La app muestra el listado antes de cargarlo. No decide la categoría a partir de una columna ambigua: se elige expresamente el grupo de destino.

El archivo máximo es de 2 MB y 500 deportistas por carga. Nombres duplicados y DNI inválidos detienen la importación. No indicar un DNI conserva el ya registrado. Una corrección de DNI mantiene el ID estable; un DNI previo rectificado queda reservado para revisión, evitando asignarlo silenciosamente a otra persona.

Para aprovechar un padrón anterior, exportarlo desde una **copia** y revisarlo con ese formato. No ejecutar el migrador Node/Firestore del paquete anterior. Si las planillas anteriores contienen asistencia, evaluaciones o fichas reales, no borrarlas ni empezar vaciándolas: se necesita una importación conciliada de esos históricos, todavía no ejecutada en esta entrega. Los datos locales de DUA/legajos sólo se recuperan desde la función de la app después de revisar personas e identidades; no importar las fichas ficticias de la demo.

## 7. Vistas de Sheets y respaldos

1. Guardar asistencia desde un profe. Comprobar que el original privado tenga las filas, el recibo y la auditoría de esa operación.
2. Desde Dirección, pulsar **Actualizar vistas de Sheets** para comprobar el destino de esa actividad. El botón no concede permisos al profe ni expone originales.
3. Revisar `Padron`, `Asistencia`, `Evaluaciones`, `Gestos`, `ApoyosDUA`, `Cambios`, `EstadoSync` e historiales de la planilla de actividad. No debe haber DNI, bitácoras privadas ni notas de sesiones. `ApoyosDUA` también debe compartirse sólo con el equipo que necesite esos apoyos: no publicar la planilla en Internet.
4. Para cargar nombres desde Sheets, usar `CargaPadron` con Categoría, Equipo y Jugador. La app trae el listado para revisar y confirmarlo; no importa DNI desde esa planilla compartida.
5. Ejecutar **`realizarBackupSemanal()`**. Aunque conserva ese nombre por compatibilidad, el activador nuevo es diario. Confirmar que se creó una copia privada de los originales, con usuarios, auditoría y archivos de temporada. La función no duplica el respaldo en el mismo día.
6. Hacer el ensayo de restauración del paso 9 antes de habilitar las automatizaciones.
7. Ejecutar **`instalarActivadoresUGI()`** sólo después del ensayo. Crea sincronización cada 15 minutos y respaldo diario a las 2 h de Buenos Aires. Cada pasada sincroniza hasta 3 actividades pendientes y rota el orden. Una carga masiva de todas las actividades puede requerir varias pasadas; el botón de Dirección permite actualizar una actividad en el momento.
8. Revisar las ejecuciones en Apps Script y ejecutar **`diagnosticoUGI()`**. Si una vista falla, el original guardado sigue disponible y queda pendiente de sincronización. Si falla el original, la app no confirma el cambio.

Las pestañas sincronizadas son vistas: los cambios manuales allí se pueden reemplazar. Usar pestañas aparte para notas y fórmulas propias. No editar `Meta`, `Control`, recibos, auditorías ni tablas originales: los cambios externos en el estado original se detectan y bloquean nuevas cargas para revisión.

Los originales privados son sólo de la cuenta que ejecuta Apps Script. `IndiceUGI` muestra qué prefijo corresponde a cada actividad. Las columnas legibles de padrón, asistencia, sesiones y evaluaciones facilitan la revisión; algunos campos extensos se conservan como JSON dividido en partes para no exceder el tamaño por celda.

## 8. Comprobación diaria durante el piloto

- Ninguna carga pendiente sin revisar al terminar la jornada.
- Original y vista con la misma versión en `EstadoSync`.
- Último respaldo confirmado y copia existente.
- Ninguna excepción de cuota; revisar tiempos reales y ejecuciones fallidas en el panel de Apps Script.
- Espacio disponible en Drive y crecimiento de las hojas. No se contrata espacio automáticamente ni se eliminan copias antiguas desde este código; definir una política de conservación antes de acumular una temporada.
- Verificar que el proyecto siga en Spark y sin Cloud Billing. Las cuotas agotadas pueden interrumpir el servicio: no se propone resolverlas habilitando cobros.

Los pendientes del navegador se conservan por cuenta y no incluyen tokens. Pueden contener datos de la carga; usar dispositivos confiables, bloquear la pantalla y cerrar sesión al terminar. No borrar los datos del navegador mientras haya pendientes. La bitácora registra el autor autenticado, no el nombre que alguien escriba en una nota.

## 9. Restauración y vuelta atrás

Ensayar con datos ficticios:

1. Crear un respaldo confirmado y anotar la última operación incluida.
2. Guardar después una asistencia adicional, para verificar la diferencia con la copia.
3. Pausar el acceso de ensayo y los activadores. Conservar una copia del estado actual antes de cambiar nada.
4. Duplicar el respaldo para usarlo como nuevo original privado. No trabajar directamente sobre la única copia de seguridad.
5. Cambiar `UGI_DATA_SHEET_ID` hacia esa copia restaurada. Mantener el mismo propietario, proyecto Firebase y `UGI_ID_SECRET`. Verificar permisos privados.
6. Ejecutar `diagnosticoUGI()`, entrar y comprobar padrón, asistencias, legajos, usuarios, recibos e historial. La carga posterior al respaldo no estará: conciliarla expresamente desde la copia del estado actual, sin prometer que el respaldo contenía información futura.
7. Actualizar las vistas manualmente. Si el respaldo conservaba `projectedVersion` igual a `version`, no esperar al activador: la vista externa puede ser más reciente que lo restaurado.
8. Los pendientes creados después del respaldo se revisan uno por uno. No reenviarlos automáticamente sin comparar datos y autoría.
9. Reanudar sólo después de la conciliación y del ensayo con el profe.

Para volver al sitio/código anterior: conservar su versión, pero no reactivar un backend anterior inseguro con datos reales. Corregir el candidato en ensayo antes de volver a habilitar cargas.

## 10. Condición para presentar y para comenzar la temporada

Completar la matriz de aceptación en `muni360-pruebas-aceptacion.md`, anotar evidencia y responsable. No marcar “aprobado” por el hecho de que abra la demo. Para la presentación hacen falta ingreso real, aprobación, guardado confirmado, historial, vista en Sheets y recuperación. Para la temporada se agrega el piloto con profes reales, volumen esperado y monitoreo de varios días.

No hay una garantía técnica de “cero errores”. El criterio es tener pruebas reproducibles, problemas críticos resueltos y recuperación ensayada.
