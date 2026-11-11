# Resultado inicial del piloto aislado

11 de noviembre de 2026. Base de partida: commit `64647e22b22ec62020e3274b1c23417b89da3ba9`. Rama `piloto/supabase-asistencia-20261111`, en una copia separada en la PC de casa.

## Código y datos probados

- Suite original: 133/133 pruebas aprobadas, sin cambiar archivos de producción.
- PostgreSQL real en WASM (PGlite 0.5.16): 12 escenarios aprobados. Aislamiento de actividad, JWT/contexto rechazado, Consulta, suspensión, vencimiento, sin tablas públicas, revisión optimista, padrón/temporada, idempotencia, rollback y outbox transaccional.
- Cliente y puente: 10 pruebas aprobadas. Pendiente durable, sin token en almacenamiento, respuesta inválida, doble reintento, descarte por ID, fallos de espacio, coordinación entre pestañas, copia literal/verificada y respuesta perdida del ack.
- Navegador Chrome local: cuatro recorridos aprobados, Profe/Consulta a 360/1440 px. Apertura, guardado, clima/puntos, rechazo de controles para Consulta, desconexión antes de guardar, recarga y reintento con el mismo ID. Sin errores JavaScript ni desborde horizontal. Google y el gateway HTTP usan fixtures; el motor de persistencia es PostgreSQL/WASM.
- Datos sintéticos: 1500 participantes / 75 grupos / 25 actividades, 6000 clases, 120000 asistencias y 6000 auditorías. No hay evaluaciones ni adjuntos en esta prueba.

## Mediciones de diagnóstico local

Estas mediciones NO incluyen red, PostgREST, validación de firma de Firebase ni API de Google. No compararlas con los tiempos del Apps Script remoto ni anunciar una mejora de velocidad real a partir de ellas.

| Medición local | Resultado |
| --- | --- |
| 25 aperturas de grupo de 20 personas, mediana / p95 | 2,96 / 15,71 ms |
| 20 guardados SQL secuenciales, mediana / p95 | 13,75 / 32,52 ms |
| Respuesta JSON de un grupo de 20 | 2674 bytes |
| Esquema privado después del fixture y 20 guardados | 34996224 bytes (33,4 MiB, aproximadamente 35 MB decimales) |

El tamaño es del esquema del piloto con datos repetitivos y auditorías históricas sintéticas. No incluye evaluaciones, adjuntos, las tablas de Auth/plataforma de Supabase ni backups. Tampoco demuestra capacidad concurrente: PGlite usa un único proceso.

## Estado externo

Preparado para conectar a un proyecto Supabase gratuito nuevo. Al escribir este reporte no había conexión Supabase confirmada ni credenciales configuradas. No se contrató ningún plan, no se crearon usuarios reales y no se desplegó en las URLs del ensayo.

Falta medir Supabase hospedado contra Apps Script bajo condiciones equivalentes, login real/gateway, varias identidades, concurrencia real y entrega a una nueva planilla Google. El puente solo fue probado con adaptadores.

Se conserva el sistema actual de ensayo. No se aplican en esta rama las correcciones de Gemini al sistema existente; este trabajo es el piloto autorizado.
