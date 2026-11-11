# Concurrencia: incidente y corrección del piloto

11 de noviembre de 2026. Solo afecta al piloto Supabase, no al ensayo Apps Script.

## Evidencia del navegador

El tercer archivo de mediciones del usuario incluyó 21 llamadas de escritura: el guardado manual previo de 187,5 ms y la tanda posterior de veinte. En esa tanda se confirmó una escritura en 79,1 ms; las otras diecinueve agotaron aproximadamente 20000 ms y quedaron clasificadas genéricamente como network. No fue una prueba aprobada de 1 guardado y 19 respuestas de conflicto.

Las 23 aperturas registradas en ese archivo fueron exitosas. Esto no compensa la falla de escritura concurrente.

## Causa

El piloto usaba SQLSTATE `40001` para comunicar un conflicto funcional de revisión, de padrón/temporada o de requestId reutilizado. Ese código representa serialization_failure y puede disparar reintentos automáticos de transacción en PostgREST. Fue una elección incorrecta del código del piloto, no una medición de la capacidad máxima de Supabase.

Los logs del intervalo 21:48:30–21:50:30 UTC registraron 97 errores `40001` de authenticator. Se observaron procesos repitiendo las llamadas y esperando locks. Se terminaron únicamente las conexiones activas del RPC de asistencia en este proyecto ficticio; después se verificó cero llamadas de guardado en ejecución.

Referencia oficial: https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

## Corrección

- Los conflictos de negocio devuelven `PT409`, que PostgREST traduce a HTTP 409.
- `40001` queda reservado para fallos reales de serialización y se trata como transitorio en el cliente.
- Las métricas nuevas conservan estado HTTP, código devuelto y distinguen timeout de error de red. Se agrega `pilotVersion=2026-11-11-pt409` al archivo exportado.
- La pantalla muestra Revisión 2 para identificar el código actualizado.
- Se corrigió el adaptador HTTP de tests: antes traducía 40001 a 409 de forma incorrecta y no reproducía el comportamiento del gateway real.

## Validación realizada

- Pruebas de cliente/puente: 13 aprobadas, incluidas tres regresiones nuevas de código HTTP, fallo transitorio y timeout.
- PostgreSQL/WASM: 12 escenarios aprobados con verificación explícita del SQLSTATE del conflicto.
- Cuatro recorridos de navegador local aprobados. El recorrido Profe a 360 px ejercita veinte solicitudes y exige una confirmación y diecinueve conflictos PT409. Google y el gateway se simulan en este recorrido.
- PostgreSQL hospedado: un guardado con revisión vieja respondió con SQLSTATE PT409 y no se aplicó.
- Contrato HTTP real: una función temporal sin acceso a datos devolvió PT409 bajo veinte solicitudes simultáneas desde la PC de casa. Veinte HTTP 409, cero timeouts; mediana 972 ms y máximo 1033 ms en esa tanda. Esto prueba el mapeo HTTP real, NO veinte guardados autenticados. La función de prueba quedó retirada: se revocó EXECUTE a todos los roles API, verificado para anon. No expuso ni modificó datos de aplicación.
- Estado persistido: dos commits reales, revisión 2 de la clase y dos trabajos pendientes hacia Sheets. No se generaron diecinueve escrituras extra.

## Pendiente

Repetir la tanda completa en la pantalla actualizada con el Google del usuario; se necesita el nuevo archivo de mediciones antes de declarar aprobada esa concurrencia autenticada. La copia a Sheets sigue pendiente de prueba real. No se aumenta el timeout como forma de ocultar el problema.
