# Preparar un ensayo vinculado a una planilla nueva

Esta alternativa simplifica el primer ensayo; no se ejecuta sobre el proyecto original del club.

1. Crear un proyecto Apps Script nuevo vinculado a una planilla cuyo nombre comience por `Muni360 - Ensayo de temporada - `.
2. Cargar los cuatro archivos .gs vigentes y appsscript.json, como indica la guia de operacion.
3. En el selector de funciones del editor de Google elegir `crearRecursosDeEnsayoUGI` y pulsar Ejecutar.
4. Revisar y autorizar los permisos de los servicios de Google que solicita el proyecto propio.
5. Esperar el mensaje `RECURSOS_ENSAYO_LISTOS` en el registro de ejecucion.

La funcion verifica que la planilla nueva sea privada y que Sheets API responda. Luego configura esa planilla como original, genera el secreto de identidades y crea una carpeta privada de respaldos y vistas para dos actividades de prueba. Repetirla no duplica los recursos ya registrados.

Si el nombre no corresponde a un ensayo, la planilla esta compartida, hay otro original configurado o falta acceso a la API, se detiene. No reemplaza la configuracion existente ni asigna permisos a profes.

El manifiesto incluye el alcance userinfo.email para verificar la cuenta ejecutora, ademas de los servicios de planillas, Drive, solicitudes externas y activadores. Las propiedades y claves privadas quedan en el proyecto de Google y no se copian al repositorio.

Despues de esta preparacion siguen la configuracion de Authentication en Spark, la vinculacion del propietario y los ensayos reales de aceptacion. Crear los recursos no significa que el acceso con Google y los guardados ya esten aprobados en produccion.


## Verificar y activar las vistas desde la app
El botón Actualizar vistas de Sheets ahora vuelve a leer las tablas del destino antes de confirmar la actividad y su versión. Si la lectura no coincide, el original permanece guardado y la vista sigue pendiente. El botón no recarga el formulario ni descarta una asistencia que se esté editando.

La cuenta propietaria puede pulsar Activar sincronización automática. Esa acción instala, sin duplicarlo, un activador de reintento cada 15 minutos y habilita la actualización verificada después de cada nuevo guardado. Una caída de la vista no invalida el original confirmado: el resultado queda pendiente para el reintento. No instala respaldos ni activa facturación. Probar con una cuenta de profe y verificar la autoría antes de usar datos reales.

La asistencia, el semáforo y el cierre de clase se conservan como borrador local separado por cuenta y actividad en cada cambio. Se envían automáticamente tras 3 segundos sin editar; ocultar la página intenta adelantar el envío. Al cerrar no se garantiza la red: se mantiene el aviso y el borrador recuperable. Una recuperación exige revisar y guardar expresamente. Los formularios de evaluaciones, padrón y legajos mantienen su confirmación manual.
