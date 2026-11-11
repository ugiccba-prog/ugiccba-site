# Vista compacta por defecto
11 de noviembre de 2026. Deportes y Colonia/COYFD.

Se retiro el boton Modo cancha y su alternancia: todos ingresan a la misma distribucion compacta. La cabecera tiene una sola linea descriptiva, sin subtitulo decorativo. Profe tiene cuatro pestanas fijas sin desplazamiento horizontal: Asistencia, Evaluar, Banco UGI y Analisis. Cambios se conserva en la interfaz de Direccion y Coordinacion; la navegacion de administracion admite sus opciones adicionales. La barra de administracion desaparece por completo cuando sus acciones no corresponden al perfil.

Grupo y fecha permanecen arriba de la lista. El encabezado de asistencia es breve y las referencias se abren con el boton de ayuda. Los indicadores se conservan en Resumen de la clase, plegado por defecto al final de la lista. El cierre opcional tambien sigue disponible.

Las fichas tienen menos separacion, conservando controles de al menos 44 por 44 pixeles. Semaforo y asistencia estan agrupados con etiquetas accesibles. Guardar asistencia queda al final, en el flujo normal, como respaldo del autoguardado; no ocupa una franja fija sobre los registros. Los avisos de pendientes conservan su visibilidad.

## Verificacion
Chrome nuevo y aislado, servidor local restringido, datos ficticios y solicitudes externas bloqueadas. No se usaron cuentas autenticadas ni se escribio en Google.

Doce recorridos: Deportes y Colonia, con perfiles simulados Direccion y Profe, a 360, 390 y 1440 pixeles. Se verificaron:
- Ausencia del boton retirado y de desborde horizontal.
- Barra vacia de administracion oculta para Profe.
- Primer jugador por encima de 470 px en los escenarios moviles de Profe.
- Ayuda dentro de los limites de pantalla.
- Resumen cerrado por defecto y accesible al desplegar.
- Controles de al menos 44 px y busqueda/estados seleccionados correctos.
- Guardado en flujo normal, acceso al ultimo jugador, filtros y evaluacion.
- Cero errores JavaScript y cero solicitudes al backend/autenticacion de Google.

En las demostraciones moviles de Profe, el primer jugador comienza a 329 px en Deportes y 379 px en Colonia. Son mediciones del escenario de prueba; avisos de pendientes, textos y datos reales pueden modificar esa posicion. Se inspeccionaron capturas de los perfiles.

## Reproduccion
Con Playwright y un navegador de pruebas disponibles:

```
node scripts/check-muni360-ui.cjs
```

MUNI360_BROWSER_PATH permite indicar Chrome; MUNI360_UI_OUTPUT el destino temporal de capturas; MUNI360_PLAYWRIGHT_MODULE una instalacion externa al repositorio. El servidor se limita a 127.0.0.1 y se cierra al terminar. El recorrido tactil real y el proyector permanecen pendientes.
