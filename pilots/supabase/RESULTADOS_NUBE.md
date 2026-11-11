# Piloto hospedado: estado del 11 de noviembre de 2026

## Recursos creados con autorización

- Organización elegida por Juan: `ugiccba-prog's Org`, plan Free.
- Cotización confirmada por Supabase: USD 0/mes para el proyecto.
- Proyecto: `muni360-piloto`, referencia `kaalffshnrkxviqaymhv`, región São Paulo (`sa-east-1`).
- API: `https://kaalffshnrkxviqaymhv.supabase.co`.
- Vista web separada y temporal: https://muni360-ugi-ensayo--supabase-piloto-xv9xng3a.web.app/ (canal de prueba de siete días, creado el 11/11/2026).
- Backend y planillas del ensayo actual sin cambios. Se verificó HTTP 200 y contenido original en Deportes, Colonia/COYFD y Administración.
- No se habilitó facturación ni se contrató cómputo adicional.

## Base real y comprobaciones

Supabase/PostgreSQL hospedado confirmó 1500 participantes, 75 grupos, 6000 clases, 120000 asistencias y 6000 auditorías ficticias. El esquema privado ocupó 37584896 bytes (35,8 MiB; aproximadamente 38 MB decimales). No incluye evaluaciones, adjuntos, esquema de Auth/plataforma o respaldos.

Se verificaron apertura de grupo de 20, guardado, recibo idempotente, rechazo de una revisión vieja, bloqueo de otra actividad y trabajo de proyección en la MISMA transacción. La prueba se revirtió al terminar: no deja clases artificialmente modificadas ni trabajos pendientes.

Estas pruebas usaron claims ficticios inyectados por una sesión administrativa en SQL. Validan el comportamiento de los roles/RPC en PostgreSQL, NO la firma de un token Google ni el gateway HTTP autenticado.

La API pública devolvió HTTP 401/código 42501 al intentar obtener el perfil sin token de Google, sin exponer filas. Los RPC expuestos son SECURITY INVOKER; los helpers privilegiados se mantienen en el esquema privado con controles de identidad/actividad. Tablas sin permisos de lectura/escritura para los roles cliente y políticas restrictivas de denegación.

Advisors de seguridad: sin hallazgos después de aplicar las políticas explícitas. Se agregó índice compuesto para el FK de asistencia/clase. Los avisos de índices aún no usados se consideran normales en este piloto nuevo, no una razón para retirar índices antes de medir el uso real. Referencia del aviso informativo: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Diagnóstico del motor hospedado (NO latencia de usuario)

Dentro de una sola transacción administrativa, con caché caliente: 25 aperturas y 20 guardados secuenciales. Apertura mediana 0,151 ms / p95 0,3772 ms. Guardado mediana 1,0435 ms / p95 1,77615 ms. Respuesta JSON textual: 2892 bytes para 20 participantes.

No incluye red, login, gateway, múltiples transacciones independientes, espera real entre usuarios ni copia a Sheets. No permite afirmar una mejora porcentual frente al Apps Script remoto. Hace falta el recorrido completo desde el mismo navegador y red.

## Lo que requiere configuración de cuenta

La conexión de ChatGPT a Supabase permite administrar la base, pero las herramientas disponibles no permiten activar la integración Third-Party Auth. Debe agregarse Firebase desde:

https://supabase.com/dashboard/project/kaalffshnrkxviqaymhv/auth/third-party

Proyecto Firebase esperado: `muni360-ugi-ensayo`. No modificar el Firebase activo, sus usuarios o claims. El piloto admite los RPC concretos con JWT de Firebase verificado aun sin claim Postgres role; no expone tablas anónimas.

La cuenta propietaria ya tiene acceso de Profe solo a actividades ficticias en esta base, usando el UID previamente proporcionado por Juan. No se migró el resto de las cuentas ni sus permisos. Las claves configuradas en la vista son públicas; no hay service_role en el navegador.

Después de vincular Firebase: login real en la vista temporal, aperturas/guardados HTTP, prueba de concurrencia y entrega verificada a una NUEVA planilla ficticia. El puente de Sheets está preparado pero no activado ni configurado con secretos. No se declara migración completa.

## Actualización verificada — 11/11/2026, después de corregir PT409

La integración Firebase quedó configurada y Juan completó login real. En el archivo `muni360-piloto-mediciones (3).json` (versión `2026-11-11-pt409`, 22:10 UTC), 20 solicitudes HTTP concurrentes con la MISMA cuenta, grupo y revisión devolvieron 1 éxito (93,2 ms) y 19 conflictos HTTP 409/PT409 (90,1–243,4 ms), sin timeouts. Las tres lecturas tuvieron mediana 68,5 ms. No son 20 profesores distintos.

Luego se enviaron 20 llamadas SQL independientes desde el conector, con 20 perfiles ficticios y 20 grupos distintos, fecha 18/11/2026. La base confirmó 20 sesiones en revisión 1, 20 autores y 400 asistencias. Las llamadas se solicitaron en paralelo, pero no se midió su solapamiento interno ni representan 20 logins Google o latencia HTTP de profesores. Los registros quedan en el piloto para verificar su copia a Sheets.

### Puente limitado preparado, pendiente de activación en Google

Proyecto NUEVO, separado del ensayo: https://script.google.com/d/1VvXToqJ7XIqxE1zBs4-aNVnSbhzbS4Oxc6WVFlfV_bID1B7WQ4bQsBNh/edit

El puente usa clave pública más una credencial aleatoria limitada a leer/confirmar la cola de proyección. La base guarda solo SHA-256, con vencimiento 18/11/2026 23:00 UTC. No utiliza service_role. Las credenciales privadas se configuran exclusivamente en Propiedades del script, nunca en fuentes ni Git. La revisión automática rechazó el primer planteo de incluir el secreto en un archivo privado de código; ese envío no se ejecutó y fue reemplazado por Propiedades del script.

La API HTTP real devolvió 401/42501 a una credencial inválida y 200 con 10 trabajos a la credencial válida. No se confirmó ningún trabajo mediante este diagnóstico. Security advisors: sin hallazgos tras la migración.

`activarPuenteSupabasePiloto` creará una planilla NUEVA y ficticia, verificará hasta tres lotes iniciales y programará copia cada cinco minutos. Cada lote se confirma en la base solo después de releer los valores escritos. Al vencer la credencial, elimina exclusivamente su propio activador. Sin trabajos pendientes no lee Sheets. No confundir copia por eventos con una planilla de estado actual: este piloto conserva revisiones como eventos; una vista amigable de última versión queda para la migración completa.

Al cerrar esta actualización, la entrega real a Sheets y el activador siguen SIN verificar: requieren configuración privada y autorización inicial del nuevo proyecto en Google. No declarar migración finalizada.

### Validación local adicional

13 pruebas de cliente/proyector y 13 escenarios PostgreSQL/PGlite, todos aprobados. Incluyen rechazo de clave incorrecta, ausente, vencida y suspendida; tabla de credenciales inaccesible al cliente; helper de autenticación privado; máximo diez confirmaciones por lote. Los escenarios locales no miden firmas Google ni rendimiento remoto.
