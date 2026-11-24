# Gimnasio Mental UGI

## Estado publicado al 24 de noviembre de 2026

Las mejoras del portal, los tres juegos y la Zona de Calma están publicadas en [el portal de jugadores](https://ugiccba.com.ar/pages/jugadores.html). El receptor de resultados en Apps Script está desplegado en su **versión 5**, conservando la URL existente.

Los cambios de implementación corresponden al commit [`a67d0f8a938005732537a839c72c5d3bcc782ffc`](https://github.com/ugiccba-prog/ugiccba-site/commit/a67d0f8a938005732537a839c72c5d3bcc782ffc). Se publicaron sobre los cambios de Muni360 que ya estaban en `main`, sin reemplazarlos. El PDF local `docs/Tutorial-Coordinadores-Muni360.pdf` quedó fuera de esta publicación.

## Cambios realizados

| Componente | Comportamiento corregido o agregado | Fuente |
| --- | --- | --- |
| Visión periférica | Acepta una sola respuesta por etapa; evita avances y registros duplicados. Al cambiar de aplicación, invalida el destello interrumpido y repite la ronda sin volver a contar respuestas ya registradas. Agrega respuesta de dirección con teclas 1 a 8 y foco visible. | `apps/training/vision.html` |
| Reacción con cámara | Cancela el ciclo de actualización al pausar y mantiene un único ciclo al reanudar. Impide reanudaciones simultáneas y finales repetidos. | `apps/training/reaccion.html` |
| Stroop | Incorpora una alternativa con símbolos e instrucciones propias. Se identifica como `SIMBOLOS`, queda fuera del ranking Stroop y no se presenta como una medición equivalente. Ignora repeticiones automáticas del teclado. | `apps/training/stroop.html` |
| Zona de Calma | Evita contar varias veces la misma finalización del anclaje, la agenda o la misma herramienta aplicada durante la sesión. Actualiza el estado al desmarcar chips. Agrega activación por Enter/Espacio, foco y estados accesibles para las tarjetas. | `ansiedad/index.html` |
| Envío de resultados | Guarda antes de iniciar la solicitud; conserva cada pendiente hasta confirmar su recepción. Mantiene la identidad en los reintentos, migra resultados antiguos sin identidad, evita reintentos simultáneos en la misma página y deja de descartar los anteriores al superar 50 pendientes. Distingue un envío pendiente de un fallo de almacenamiento. | `apps/training/ugi-envio.js` |
| Ranking del portal | Descarta respuestas tardías de una pestaña anterior, para no mostrar resultados de otro juego bajo la pestaña activa. | `assets/scripts/ranking.js` |
| Receptor y ranking del servidor | Usa un bloqueo e `id_sesion` para evitar insertar dos veces la misma sesión. Exige los datos básicos de cada envío. En Visión rechaza marcas sin controles centrales o rondas suficientes, umbrales fuera de 40–900 ms y números no finitos. | `apps-script/Codigo.gs` |

Los juegos también incorporan mensajes de guardado anunciables, foco visible y respeto por la preferencia de movimiento reducido. Las pantallas de inicio y resultados de Visión permiten desplazamiento cuando falta altura.

## Identificación del Apps Script en producción

- **Cuenta propietaria y ejecutora:** `ugiccba@gmail.com`.
- **Nombre:** Gimnasio Mental UGI - Resultados y ranking.
- **Editor:** [abrir el proyecto](https://script.google.com/home/projects/1VU72clBCYLKTm3dsC7KipS5iPhXkgMFPrU_lRw8utybsRAr5t69i_-h0/edit).
- **ID del proyecto:** `1VU72clBCYLKTm3dsC7KipS5iPhXkgMFPrU_lRw8utybsRAr5t69i_-h0`.
- **ID de implementación activa:** `AKfycbzzz9bgYenOAydgE78qgL6ChB7L7cpQq8_REOPXZrpGcN3t74XKPnCXy5tTUKQWiXky`.
- **Versión publicada:** 5, con descripción «Gimnasio Mental: resultados sin duplicados y ranking validado».
- **Receptor:** [aplicación web existente](https://script.google.com/macros/s/AKfycbzzz9bgYenOAydgE78qgL6ChB7L7cpQq8_REOPXZrpGcN3t74XKPnCXy5tTUKQWiXky/exec).
- **Configuración conservada:** ejecutar como propietario; acceso «Cualquiera»; V8; zona horaria `America/Argentina/Buenos_Aires`.

El proyecto estaba **en la papelera junto con su planilla contenedora**. Se localizó con Desktop Commander y el historial de Apps Script del perfil UGI de Chrome; se confirmó que la implementación coincidía exactamente con `DATABASE_URL` en `ugi-envio.js`. Se restauraron el proyecto y su contenedor, se conservó una copia del código anterior y se renombró el proyecto para poder localizarlo después.

La copia previa y la carpeta usada para desplegar quedaron localmente en `scratch/mental-deploy-20261124/`, excluidas de Git. Se comparó el código remoto con el del repositorio antes de actualizarlo: las diferencias correspondían a las correcciones del bloqueo, la deduplicación y las validaciones del ranking. Se conservó el manifiesto del proyecto remoto; **no se subió toda la carpeta `apps-script/`**, que contiene además módulos de otros sistemas.

## Verificaciones realizadas

- Las seis pruebas de `tests/gimnasio-mental.test.cjs` pasaron: conservación de pendientes durante el envío, errores de red, más de 50 pendientes, migración de identidad, filtros del ranking de Visión y deduplicación del servidor con liberación del bloqueo.
- La comprobación de navegador `scripts/check-gimnasio-mental.cjs` verificó carga sin errores de JavaScript ni desborde horizontal a 390 y 1280 px; partidas completas de Visión y Stroop normal/con símbolos; respuesta duplicada e interrupción de Visión; dos pausas y doble reanudación de Reacción; accesibilidad y contador de Calma; respuestas fuera de orden del ranking.
- La cámara y las respuestas de red del recorrido automatizado se simularon. No se validó la detección con una cámara física.
- Se comprobó que los seis archivos públicos modificados respondían HTTP 200 y coincidían con el contenido local del commit publicado.
- Se confirmó la versión 5 en la implementación activa, tanto mediante `clasp` como en «Administrar las implementaciones» del editor.
- Las consultas públicas de existencia de sesión y de los rankings `STROOP`, `REACCION` y `VISION` respondieron HTTP 200 con `ok: true`. La consulta de Visión requirió un reintento por timeout.
- Las comprobaciones de producción fueron de lectura: no se cargaron resultados sintéticos en la planilla real.

Para repetir las pruebas desde el repositorio:

```powershell
node --test tests/gimnasio-mental.test.cjs
node scripts/check-gimnasio-mental.cjs
```

También están disponibles `npm run test:mental` y `npm run check:mental:ui`. El recorrido de navegador utiliza Edge de Windows por defecto y admite otra ruta mediante `MUNI360_BROWSER_PATH`.

## Próximas publicaciones

Actualizar este registro con los cambios, pruebas, commit y estado real del despliegue. Registrar por separado la publicación del sitio y la del receptor: subir `Codigo.gs` a GitHub no actualiza Apps Script.

Para el receptor, abrir el proyecto identificado arriba y actualizar **la implementación existente** a una nueva versión. Mantener el manifiesto remoto y verificar el alcance de los archivos antes de usar `clasp push`. No crear otro proyecto ni cambiar `DATABASE_URL` si la implementación se puede conservar. La versión 4 anterior se mantiene como referencia de reversión del servidor; cualquier reversión debe coordinarse con el comportamiento del cliente publicado.
