# Muni360: preparación de demostración e Inteligencia

Revisión: 19/11/2026. Rama: `dev/muni360-inteligencia-demo`.

## Resultado preparado

Catálogo recibido del usuario: 16 deportes, 22 actividades al separar las ramas que ya existen en el catálogo institucional. No se reemplaza el catálogo oficial de 25 actividades: Handball, COYFD y Colonia quedan fuera del pedido de estos 16 deportes.

Se generan 2760 inscripciones sintéticas, 88320 asistencias y 11040 evaluaciones en 16 semanas (27/07–12/11/2026), dos encuentros semanales y ocho participantes por grupo. Nombres DEMO, DNI vacío, identificadores estables sin datos personales. Las semanas 1–4 tienen asistencia estable, 5–12 caída y 13–16 recuperación de A y persistencia en B. No representan resultados reales del club.

Se preservan literalmente las 39 divisiones de fútbol entregadas: 26 TAFF, cuatro Fútbol 11, cuatro TIFA y cinco femeninas. La categoría conserva su código; el eje equipo identifica la modalidad original, sin agregar A/B a esas divisiones. Los otros deportes usan equipos o grupos A/B. La rama se resuelve mediante la actividad institucional. Gimnasia, patín y deportes con peso/nivel requieren completar dimensiones técnicas antes de una inscripción federativa: este catálogo es de demostración, no una certificación reglamentaria. No se inventan pesos ni equivalencias federativas.

## Conexiones encontradas en código

- `assets/scripts/muni360-config.js`: backend Supabase; Edge Function del proyecto `kaalffshnrkxviqaymhv`; Firebase Auth del proyecto `muni360-ugi-ensayo`.
- `server/supabase/functions/muni360`: verificación de identidad, permisos, operaciones y panel agregado. `domain.mjs` define el contrato usado por el generador; cada asistencia y evaluación pasa por sus validaciones reales.
- `assets/scripts/muni360-dashboard.js` consulta `/api/dashboard` para Coordinación y Dirección UGI; `dashboard.mjs` lee estados compartidos mediante el servicio, sin devolver registros individuales. El generador utiliza su misma función `summarize` para preparar indicadores locales.
- `docs/muni360-planillas.md` identifica Planilla Madre y proyecto Apps Script. `server/supabase/tools/SheetsInstitucional.gs` y el mantenimiento institucional proyectan información hacia Sheets. La documentación establece ejecución cada cinco minutos: no se verificaron los disparadores vivos ni sus credenciales.
- Los comentarios antiguos «100% Google Sheets» dentro del HTML contradicen la configuración vigente; no deben usarse para decidir dónde cargar datos.

Inspección de código y documentación, no verificación autenticada del estado hospedado. No se usaron credenciales de servidor, tokens de usuarios ni se leyeron datos personales de la base.

## Reproducción local

1. `python scripts/prepare-demo-catalog.py` reconstruye `demo/catalogo.json` desde la transcripción recibida.
2. `node scripts/muni360-demo.mjs demo/catalogo.json salida.json` genera datos y paneles locales. La salida debe ser un archivo nuevo: se rechaza sobrescribirlo.
3. Para reiniciar la demostración, generar otro archivo desde el mismo catálogo: los datos y los ID son deterministas.

El JSON contiene `synthetic: true` y `target: local-only`. No es una migración, respaldo ni archivo de importación de producción. No incluye usuarios, permisos, auditorías, recibos ni proyecciones. Las divisiones de una misma actividad se agregan sin reemplazarse. No hay cliente de red ni mecanismo de carga hospedada en el generador.

## Validación ejecutada

- `npm run test:muni360`: 163 pruebas aprobadas, ninguna fallida.
- `npm run check:muni360-public`: 26 archivos públicos verificados.
- `node --test server/supabase/tests/*.test.*`, con `MUNI_PGLITE_MODULE` apuntando al paquete fijado del piloto: 60 pruebas aprobadas, ninguna fallida.
- Dependencias del piloto instaladas con `npm ci --prefix pilots/supabase`.
- Se regeneró el paquete público local para comprobar su integridad. Las diferencias de fin de línea de Windows provocaron inicialmente dos errores; la compilación local resolvió las comprobaciones sin modificar fuentes de la aplicación.

## Pendientes y bloqueos para revisión

Los paneles existentes quedan preparados para ensayos con este contrato compartido; no se agregó una pantalla nueva ni se conectó la demostración al servidor hospedado. Profesores, Coordinación y UGI deben probarse en un entorno de ensayo autenticado, con permisos reales separados por actividad. Falta definir/proveer ese entorno y verificar allí las proyecciones, disparadores, copias y acceso Firebase.

Las alertas de ausencias consecutivas, caída de asistencia, intervenciones y escalamiento tras 48 horas no se implementan con este generador. Se preparan escenarios de asistencia para probarlas; la cola semanal existente no equivale al escalamiento solicitado. Pendiente definir contrato persistente de alerta/revisión/intervención y su proyección antes de incorporar esa funcionalidad. Las evaluaciones generadas tienen dos variables de prueba, no reemplazan la configuración deportiva real.

No se modificó `main`, no se ejecutaron migraciones remotas, no se cargaron datos en Supabase/Sheets y no se desplegó producción. La carga futura necesita un adaptador revisado que use las operaciones autorizadas y conserve auditoría, recibos, revisiones y proyecciones; no insertar estos estados directamente en tablas.
