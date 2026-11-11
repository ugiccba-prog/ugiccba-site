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
