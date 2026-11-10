> REFERENCIA HISTÓRICA. No instalar esta versión. La guía vigente es `muni360-operacion.md` (Apps Script v3 con Google).

> HISTÓRICO: esta guía corresponde a la propuesta previa con contraseñas propias y Apps Script. NO instalarla para la arquitectura con Google. Ver muni360-operacion.md.

# Muni 360 · Actualización de seguridad y persistencia

## Estado y orden de publicación

Este cambio prepara una API **v2 incompatible con las claves públicas antiguas**. Publicar sólo el HTML no actualiza Google Apps Script. No fusionar el cambio del sitio hasta configurar cuentas y publicar el backend. Las claves antiguas están expuestas en el historial público de Git y se deben reemplazar; eliminarlas del archivo actual no las revoca en Google.

1. Desde la cuenta propietaria de Google, hacer una copia de las 25 planillas y del proyecto Apps Script. No ejecutar el creador masivo de planillas: las existentes se conservan.
2. Preparar una implementación de prueba en Apps Script con copias de las planillas. Usar exclusivamente datos ficticios para las comprobaciones de escritura. En ese proyecto ajustar `SHEET_IDS` para que apunte a las copias.
3. En el proyecto de **Deportes/Muni 360**, reemplazar `DeportesUGI.gs` y agregar `Muni360Core.gs`. Ambos pertenecen al mismo proyecto. No mezclar los backends de los juegos cognitivos o de selectividad de hockey: tienen sus propios `doGet`/`doPost`.
4. Configurar cuentas individuales como se indica abajo y ejecutar `instalarAccesosUGI`. La cuenta propietaria autoriza el uso de Sheets y Drive. La función crea una planilla privada para legajos y apoyos. No hacerla pública ni compartir las planillas con “cualquiera con el enlace”.
5. Publicar una **nueva versión** de la aplicación web. Mantener la URL `/exec` existente si se actualiza su implementación. Si cambia, actualizar `URL_SCRIPT_DEPORTES` en **los dos portales**.
6. Comprobar con una cuenta de Profe, una de Coordinación y una de Dirección. Probar ingreso válido, contraseña incorrecta, corte de conexión y reenvío, sesión vencida, permisos entre deportes, recuperación de fichas y archivo de temporada en las copias de prueba.
7. Aplicar el backend en producción con los IDs oficiales. Retirar implementaciones web antiguas que todavía expongan la API insegura. Verificar también que el HTML antiguo no tenga otro endpoint activo. El frontend viejo no debe continuar funcionando con claves compartidas.
8. Fusionar el cambio del sitio después de verificar la API v2. La interfaz requiere `apiVersion: 2`; si encuentra el backend anterior muestra un error y no concede acceso local.
9. Ejecutar `crearActivadorViernes()` una sola vez y `realizarBackupSemanal()` para verificar permisos y copias. Consultar las ejecuciones de Apps Script. Dirección verá el resultado más reciente en Padrón. Verificar además una restauración sobre una **copia**, sin sobrescribir datos reales.

La configuración y publicación de Apps Script, las credenciales reales, los permisos de Drive y el activador no se realizan al hacer un commit en GitHub. Debe completarlos la cuenta propietaria; no enviar contraseñas por chat ni incorporarlas al repositorio.

## Cuentas individuales

En **Configuración del proyecto → Propiedades del script**, crear temporalmente `UGI_AUTH_BOOTSTRAP` con un array JSON. Cada elemento contiene:

| Campo | Valor |
| --- | --- |
| `usuario` | Identificador individual en minúsculas; letras, números, `.`, `_`, `-`, `@`. |
| `nombre` | Nombre que aparecerá como autor de las cargas. |
| `rol` | Exactamente `Profe`, `Coordinación` o `Dirección UGI`. |
| `deportes` | Array de nombres exactos de `SHEET_IDS` a los que tendrá acceso. Dirección recibe las 25 actividades. |
| `clave` | Contraseña nueva, individual y aleatoria de al menos 16 caracteres, creada con un gestor de contraseñas. |
| `activo` | `true` para habilitar; `false` para deshabilitar. |

Ejecutar `instalarAccesosUGI`. La función valida el listado, guarda hashes con salt individual en propiedades privadas, cambia la versión de las cuentas incluidas y elimina la propiedad temporal con las contraseñas. Cada cuenta ocupa una propiedad independiente para no superar el límite por valor de Apps Script. Las cuentas no incluidas conservan su configuración. Al cambiar una cuenta, sus sesiones anteriores dejan de ser válidas.

Para modificar una contraseña o permisos, repetir el proceso sólo para esa cuenta. Para desactivar una cuenta sin cambiarle la contraseña, editar su propiedad `UGI_USER_<usuario>` y poner `activo` en `false`. No modificar hashes, IDs ni salts manualmente. La información de las propiedades no debe incluirse en logs o capturas.

| Operación | Profe | Coordinación | Dirección |
| --- | --- | --- | --- |
| Asistencia, evaluación, sesión de cancha, tarjeta verde | Actividades autorizadas | Actividades autorizadas | Todas |
| Leer apoyos DUA | Actividades autorizadas | Actividades autorizadas | Todas |
| Leer DNI y bitácora privada; administrar padrón, apoyos y variables | No | Actividades autorizadas | Todas |
| Archivar temporada | No | Actividades autorizadas | Todas; cierre general secuencial |

Las sesiones duran como máximo seis horas y también pueden vencer antes si Google expulsa la entrada de caché. Cerrar sesión revoca el token. No se aceptan tokens por su prefijo ni se permite ingresar sin conexión. La contraseña distingue mayúsculas. La limitación de intentos es por cuenta y global; no reemplaza un proveedor institucional de identidad si el alcance crece.

## Guardado, pendientes y conflictos

- “Confirmado por Google” exige una respuesta v2 positiva con el mismo identificador de operación. Un error HTTP, respuesta inválida, rechazo o falta de conexión nunca se presenta como éxito.
- Las cargas pendientes persisten en este navegador, separadas por cuenta. Se reintentan al recuperar conexión, cada 30 segundos o al pulsar Reintentar. Se conserva el mismo ID para que una respuesta perdida no duplique una carga ya aplicada.
- La cola usa Web Locks para coordinar pestañas. Se necesita un navegador actualizado y almacenamiento disponible. Una actividad debe haberse leído con conexión antes de preparar cargas.
- Los pendientes **no equivalen a una copia de seguridad**: no borrar los datos del navegador mientras existan. En un dispositivo compartido, completar la sincronización antes de cerrar sesión. La caché de lectura y el token sólo permanecen en la pestaña y se limpian al salir; los pendientes se conservan hasta su confirmación o descarte explícito.
- Si otra persona modificó el mismo registro, la cola se detiene. “Revisar pendiente” permite ver el contenido pendiente y consultar los datos actuales. El reenvío requiere revisar y confirmar; también se puede descartar únicamente esa carga. Las cargas de una temporada anterior no se reenvían a la actual.
- El autor de sesiones y eventos procede del usuario validado por el servidor. Los eventos de bitácora ya guardados se conservan; una corrección se registra como un evento nuevo.
- Sheets no ofrece una transacción que abarque varias escrituras. Un fallo del servicio entre la escritura de datos y su registro de operación puede requerir revisión manual; el control de versiones y las copias evitan confirmar silenciosamente un reemplazo incierto.

## Legajos, identidad y recuperación local

Los apoyos y legajos se almacenan en la planilla privada compartida indicada por `UGI_LEGAJOS_SHEET_ID`. Se vinculan a un ID estable del padrón, no a una coincidencia casual de nombre. El DNI se mantiene en la columna E; la nueva columna F contiene el ID. Cuando un mismo DNI aparece en otra actividad se reutiliza su identidad. Las correcciones que intentarían fusionar identidades diferentes se detienen para revisión de Dirección.

Las fichas se comparten entre dispositivos y usuarios **con permiso en esa actividad**. Un Profe recibe los apoyos prácticos DUA, no el DNI ni la bitácora privada. Dirección puede consultar otras actividades seleccionándolas. No se exponen automáticamente notas privadas de otras áreas a coordinadores que no tienen autorización.

Los registros antiguos del navegador no se suben automáticamente ni se eliminan. En cada dispositivo que tenga fichas reales, Coordinación puede usar **Recuperar fichas antiguas de este dispositivo**. Revisar que las personas y las notas correspondan al padrón real y que no sean muestras de video. Se recuperan sólo fichas aún vacías en Google. Se conservan los originales locales hasta verificar la recuperación. Los datos antiguos que sólo tengan un nombre ambiguo requieren revisión humana. No se migran fichas predeterminadas de demostración.

Un deportista sin apoyo registrado no recibe la ficha de otra persona aunque su nombre incluya “DUA”. El modo demo tiene su propio almacenamiento y todos los envíos del portal pasan por un bloqueo que impide transmitir datos de muestra.

## Temporadas e indicadores

- Archivar hace copias de Asistencia, Evaluaciones, Padrón y Gestos dentro de la planilla y comprueba que estén completas **antes** de limpiar el ciclo actual. El padrón se conserva salvo que se elija expresamente archivar y vaciarlo. Los legajos se conservan.
- Las copias quedan registradas en `_TemporadasUGI`. En Análisis se puede comparar el grupo seleccionado con una temporada archivada. La comparación incluye todo el historial de cada temporada y muestra técnica, formación, asistencia y cantidad de registros. La composición del grupo puede haber cambiado.
- El cierre de todo el club se ejecuta actividad por actividad y se detiene ante un error, informando las completadas. No promete un resultado global si alguna falla. Un cierre interrumpido después de crear las copias bloquea nuevas cargas hasta reintentar ese cierre.
- No borrar ni editar manualmente `_OperacionesUGI`, `_ControlUGI`, `_TemporadasUGI`, Identidades o Fichas. Contienen la información de control, auditoría e identidad. Para restaurar un archivo, copiar primero la planilla y trabajar sobre la copia.
- Asistencia y semáforo comienzan “sin registrar” / “sin observar”. Los ausentes no observados emocionalmente no se cuentan como verdes; los estados de asistencia sin registrar no forman parte del denominador del presentismo.
- Las notas técnicas y las formativas se informan por separado. La falta de datos se presenta como tal. Las alertas orientan una revisión humana; no activan planes ni sanciones.

## Validación automatizada

Ejecutar `npm run test:muni360` (Node 22 o superior). Las pruebas usan Sheets, propiedades y caché simulados e incluyen integración entre el cliente de sincronización y el backend. No acceden ni escriben en Google real. La prueba de arranque incluye ambos portales. El diseño visual se conserva en esta etapa; la adaptación de la interfaz al trabajo dentro de la cancha queda para la siguiente iteración.
