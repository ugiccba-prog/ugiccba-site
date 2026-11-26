# Estadísticas de competición — entorno separado

Solicitud del 26/11/2026: preparar estadísticas y su entrada sin modificar main.

## Accesos

- Inicio de pruebas: https://muni360-ugi-ensayo--estadisticas-competencia-7tc3mg2f.web.app/
- Panel: https://muni360-ugi-ensayo--estadisticas-competencia-7tc3mg2f.web.app/estadisticas/
- Entrada propuesta para una futura integración: Deportes → Hockey sobre patines → Competición.
- Canal Firebase: estadisticas-competencia. Vence el 26/12/2026 a las 13:25 UTC; se puede renovar con el mismo comando.
- Rama: feature/estadisticas-competencia. Main se mantiene en 14cefcddd27c0376007bfb268097434a61f1421b; no se hizo merge ni push a main en esta tarea.

## Vista implementada

Hockey sobre Patines Caballeros y Damas; filtros por categoría, fechas argentinas y datos ficticios o reales separados. Predetermina los datos ficticios solicitados anteriormente. Muestra partidos finalizados, ganados/empatados/perdidos, goles a favor/en contra, tarjetas azules/rojas y fair play. Tabla por jugador con convocatorias, goles, goles de penal y tarjetas; historial con acciones desplegables.

La consulta usa los endpoints existentes /api/me y /api/competencia/list, sin modificar backend, permisos ni datos. Cobertura explícita: los últimos 50 registros de Competencia entre todos los deportes. No representa toda una temporada si se alcanza ese límite. Convocatorias no equivale a partidos jugados ni minutos. Las métricas individuales avisan cuando falta la instantánea de acciones.

El enlace a la mesa utiliza el módulo de Competencia existente en el mismo canal; guardar allí conserva su comportamiento habitual y escribe en el servicio real. El panel de estadísticas solo consulta. El HTML de acceso es público; las competencias requieren Google y autorización del propietario. Firebase sincronizó el dominio autorizado del canal al publicarlo; el backend ya admite ese patrón de canales y no se alteró su configuración.

## Construcción y publicación

Fuentes: apps/muni360/estadisticas-preview. No se cambió el empaquetado principal ni se agregó un acceso al portal de producción.

```text
node scripts/build-competencia-preview.cjs
node --test tests/competencia-estadisticas.test.mjs
node scripts/check-estadisticas-preview.cjs
firebase hosting:channel:deploy estadisticas-competencia --project muni360-ugi-ensayo --config firebase.competencia-preview.json --expires 30d --non-interactive --json
```

No usar firebase deploy para esta vista. El paquete de prueba en scratch/estadisticas-preview incluye únicamente entrada, estadísticas, mesa y los dos scripts públicos de acceso.

## Verificación

Cuatro pruebas de cálculo aprobadas: resultados y acciones por jugador; separación ficticios/reales y exclusión de partidos sin finalizar; fecha argentina y filtros vacíos; aviso de detalle incompleto. Navegador con autenticación simulada a 360 y 1440 px: navegación desde la entrada, filtros, estados vacíos, nombres tratados como texto, ausencia de desborde de página y llamadas solo a me/list. Captura móvil inspeccionada.

Publicación Firebase ed724904d8960997 confirmada. HTTP 200 y coincidencia exacta de entrada, panel y módulo; JavaScript servido con MIME correcto. API rechaza acceso anónimo con 401 y admite el origen del canal. Ingreso Google con la cuenta real pendiente de aceptación del propietario.
