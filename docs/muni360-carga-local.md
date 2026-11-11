# Prueba reproducible de carga y concurrencia
Fecha: 11 de noviembre de 2026. Rama de revision; datos ficticios en memoria. Ninguna de estas pruebas envia cargas al ensayo activo de Google.

## Resultado
Se usaron el cliente real de pendientes y el motor Apps Script real, con adaptadores simulados de Google. Veinte perfiles Profe autorizados, veinte grupos y veinte participantes por grupo: 400 personas. Las solicitudes de clientes se inician juntas; el adaptador procesa las operaciones en serie, como lo exige el bloqueo del script. Esto verifica integridad y orden bajo concurrencia de clientes, no latencia ni capacidad simultanea del servicio Google.

| Escenario | Resultado comprobado |
| --- | --- |
| Veinte profes en grupos distintos | 400 asistencias; veinte cambios con autores distintos y colas vacias; vistas verificadas. |
| Veinte profes sobre el mismo registro | Un guardado; diecinueve conflictos conservados; reintentar no sobrescribe al primero. |
| Veinte dispositivos offline, recarga y respuesta perdida despues del commit | Recuperacion completa; un recibo y una auditoria por operacion; cero pendientes finales. |
| Limite simulado de 60 lecturas/minuto | Las cargas no confirmadas quedan pendientes y se recuperan por tandas. La proyeccion posterior confirma las 400 asistencias. |

## Mejora aplicada
Antes, los veinte guardados con sincronizacion automatica consumian 239 lecturas de Sheets: 11,95 por guardado. Despues consumen 159: 7,95 por guardado, aproximadamente un 33,5 % menos. Se conservan tres escrituras por guardado (original atomico, proyeccion y marca verificada). El conteo excluye preparacion, lecturas iniciales y comprobaciones finales.

- Los metadatos de pestanas se reutilizan solo durante una solicitud. Se descartan al terminar y se invalidan despues de toda escritura, incluida una respuesta perdida. No se almacenan autorizaciones ni datos personales en esta cache.
- La sincronizacion inmediata utiliza el estado recien confirmado en el original atomico. Mantiene la comparacion de lectura del destino antes de marcar la vista como actualizada.
- El recorrido incluye una regresion que exige como maximo ocho lecturas promedio por guardado en este escenario.
- Con cuota, las tandas del escenario pasan de aproximadamente seis a cuatro minutos virtuales. No representa un plazo garantizado: es un reloj simulado con una cuota y una politica de reintentos determinadas.
- Los tiempos de CPU observados por escenario estuvieron por debajo de un segundo en la PC usada. No se publican como tiempos de guardado en Google.

## Como reproducir
Desde la raiz del repositorio:

```powershell
node --test tests/muni360-load.test.cjs
npm.cmd run test:muni360
```

Cada escenario informa sus contadores y tiempo local en la salida del ejecutor. El caso de volumen previo conserva ademas 500 participantes y 6000 asistencias historicas, con cierre y proyeccion.

## Limites pendientes
La integridad local aprobada no aprueba V01/V02 en Google. Quedan por medir mediana/p95 y cuotas de solicitudes autenticadas reales, latencia de la red del club y el volumen previsto para todas las actividades. El acceso remoto disponible permite ejecutar codigo local y desplegar, pero no controlar el navegador autenticado del usuario ni ejecutar funciones privadas de Apps Script remotamente. No se agrego una ruta publica para saltar autenticacion, no se crearon usuarios reales para carga masiva y no se cambio facturacion. El ensayo de cierre sobre copias si fue confirmado en Google en el registro de aceptacion.
