# Primera revision visual de cancha
11 de noviembre de 2026. Aplicada a Deportes y Colonia/COYFD.

Se mantiene la identidad azul institucional, el escudo y el celeste. La cabecera tiene una marca breve y una segunda linea descriptiva. Asistencia pasa al primer lugar de la navegacion. Las pestanas se distribuyen en dos filas en celular para que las funciones no queden recortadas en una tira horizontal.

El contexto muestra grupo, equipo y fecha completos. Los tres indicadores tienen una distribucion consistente; el semaforo separa la cantidad observada de las alertas y explicita cuantas personas siguen sin observar.

Cada persona tiene su tarjeta. Semaforo y asistencia aparecen como grupos separados con nombre; los controles incluyen etiquetas accesibles y areas tactiles de al menos 44 por 44 pixeles. En celular se apilan para conservar ese tamano. El apoyo DUA y la comida mantienen sus controles. En modo cancha, Guardar asistencia queda al pie; el contenido tiene espacio de salida para alcanzar los ultimos controles. El aviso de cambios pendientes sigue visible.

## Verificacion
Se uso un navegador Chrome nuevo y aislado, un servidor local restringido y datos de demostracion. Se bloquearon solicitudes externas; no se uso el navegador autenticado del usuario ni se escribieron datos en Google.

Seis recorridos: ambos portales a 360, 390 y 1440 pixeles de ancho. Se verificaron:
- Ausencia de desborde horizontal y de errores JavaScript.
- Controles de semaforo y asistencia de al menos 44 pixeles.
- Busqueda de persona y cambios de asistencia/semaforo con estado seleccionado correcto.
- Acceso al ultimo control sin superposicion con el guardado fijo.
- Apertura/cierre de filtros y acceso a la ficha de evaluacion.
- Guardado fijo oculto al navegar a evaluacion.
- Ninguna solicitud a autenticacion ni al backend de Google durante la prueba local.

Las capturas se inspeccionaron visualmente. La prueba no sustituye un recorrido tactil real en la cancha ni la comprobacion del proyector.

## Reproduccion
Con las dependencias de desarrollo y un navegador Playwright disponible:

```
node scripts/check-muni360-ui.cjs
```

Se puede indicar MUNI360_BROWSER_PATH para un ejecutable de Chrome y MUNI360_UI_OUTPUT para guardar las capturas temporales. MUNI360_PLAYWRIGHT_MODULE admite una instalacion de pruebas externa al repositorio. El servidor se limita a 127.0.0.1, publica solo las carpetas estaticas necesarias y se cierra al terminar.
