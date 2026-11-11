# Cierre de la candidata de ensayo para presentacion
11 de noviembre de 2026. Rama revision/muni360-apps-script-cero-20261110.
Estado: funcionalidad publicada; candidata preparada para presentar. No es una aprobacion de uso general de temporada.

## Evidencia
| Capa | Resultado |
| --- | --- |
| Suite de codigo | 125 pruebas aprobadas; dominio, permisos, identidad, colas, conflictos, importacion, privacidad, restauracion, cuotas y horario. |
| Interfaz | Doce recorridos Chrome a 360, 390 y 1440 px, con Direccion y Profe simulados, sin errores JavaScript ni desborde. |
| Flujo completo | Deportes y Colonia sin modo demo, con la app y motor Apps Script conectados mediante adaptadores Google en memoria: DUA, privacidad, autoguardado, persistencia tras reabrir, evaluacion 6,5, offline/reconexion y doble toque. Panel propietario comprobado. 21 peticiones API en el recorrido. No usa cuentas ni servicios Google reales. |
| Integracion continua | Workflow Muni 360 checks aprobado para el commit previo de cierre: https://github.com/ugiccba-prog/ugiccba-site/actions/runs/43068514977 |
| Google real | Ingreso/aprobacion y guardados de roles, persistencia entre dispositivos, sincronizacion automatica a Sheets, conflictos, importacion, exportacion, primera noche de respaldo, recuperacion exacta y cierre aislado. Alcances y variantes en muni360-pruebas-aceptacion.md. |
| Publicacion | Portales de ensayo publicados; horario argentino; cuatro pestanas de Profe fijas y sin Cambios. Backend Apps Script desplegado en version 6. |

No se encontro un defecto nuevo en el recorrido final. Se agrega scripts/check-muni360-flow.cjs para reproducirlo sin depender de la cuenta del usuario ni modificar datos del ensayo.

## Documentacion de operacion
- muni360-guia-uso.md: uso de Profe y Direccion, mensajes, pendientes y recorrido de presentacion.
- muni360-operacion.md: configuracion, sincronizacion, respaldos, restauracion y vuelta atras.
- muni360-pruebas-aceptacion.md: evidencia real separada de automatizacion.
- muni360-carga-local.md: prueba de carga local y limites de extrapolacion.
- muni360-estetica.md: distribucion compacta y controles de interfaz.

## Alcance del cierre
Se congela esta candidata para preparar la presentacion. Los defectos encontrados se corrigen sobre la rama de revision; no se agregan funciones nuevas como condicion de cierre. La rama principal y los originales del club quedan fuera de esta publicacion de ensayo.

Para autorizar el inicio de temporada faltan las variantes reales pendientes de la matriz, medicion con varias cuentas y volumen representativo en la red del club, observacion de varias noches de respaldo/sincronizacion, espacio de Drive y recorrido en proyector. No se marcan como aprobados por los tests locales ni por la estetica.

El objetivo de costos se mantiene sin habilitar facturacion o aumentar cuotas como solucion a saturacion. Las esperas por cuota, las caidas del proveedor y la recuperacion de pendientes son parte de la operacion: no se promete guardado instantaneo en toda circunstancia.
