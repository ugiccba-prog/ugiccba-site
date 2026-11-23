# Asistencia horizontal por grupo y tira

Formato activo en las planillas que Muni360 actualiza automáticamente. No modifica la base de padrones ni asistencias, ni convierte las nuevas pestañas en formularios de carga.

Cada combinación de categoría/grupo y equipo/tira/subgrupo recibe una pestaña `Asist · <grupo> · <tira>`. Cuando el equipo es General se omite esa parte del título. Los nombres están en filas y las fechas registradas, ordenadas de menor a mayor, en columnas. Al pie se muestra Total presentes por fecha (P + T). En Colonia, actual y futura, se agregan Total comedor y Total vianda; las marcas P/T con comedor incluyen 🍴 (y P/T sin 🍴 cuentan como vianda). Sólo se cuentan comedor y viandas de participantes presentes o que llegaron tarde. Las fechas son comunes a todos los grupos de la misma actividad, para que también se vean las cargas faltantes. Quedan fijos la fila de fechas y la columna de nombres.

Se conserva el padrón completo aunque todavía no tenga asistencia; los participantes con registros históricos también se conservan. Una celda sin marca queda vacía. Los duplicados idénticos no aumentan filas ni totales. Una marca contradictoria se muestra como Revisar y el total de ese día también indica Revisar. Un día sin marcas válidas muestra Sin registros; un día con ausencias confirmadas puede mostrar cero presentes.

Los títulos se ajustan al límite de Google Sheets y se diferencian incluso si contienen caracteres no admitidos. Los nombres se escriben como texto literal. Las columnas de fechas antiguas se vacían si la temporada cambia, y las pestañas de grupos retirados se conservan con el aviso Sin registros de esta temporada. Las pestañas generales, CargaPadron y los datos originales se mantienen.

La función canónica está en `server/supabase/tools/AsistenciaHorizontal.gs` y se incluye al final de las dos variantes del puente para que cada archivo de instalación sea autónomo. Las pruebas comprueban que ambas copias coincidan.

## Activación y validación del 22/11/2026

Proyecto oficial: `11B4Nfn84rYQU51pSzz0W1L9U3Z7XStXFH69Gt9obNZO-eFgY8Z5CFkZP`, vinculado a la Planilla Madre de Control `1s8bmpNq_4RkxKQjm2Rn2_fBqZ7aWrI8suetSSxix-uA`. Es el destino indicado en `docs/muni360-planillas.md`. Se verificó el vínculo y el contenido remoto antes de modificarlo; el proyecto retirado v1/v2 no se modificó.

Se conservaron copias locales privadas y versiones inmutables 14 a 17 antes de las distintas actualizaciones. Se cambiaron únicamente SheetsInstitucional y PlantillasMuni360; los otros nueve archivos, el manifiesto, los permisos y los activadores permanecieron iguales. No se publicó ningún endpoint nuevo.

La madre conserva sus 25 enlaces y sus pestañas de datos originales. Se actualizó el índice con la explicación del formato y el menú Muni360 incluye Actualizar planillas. Esa acción sólo procesa vistas pendientes y actualiza el índice; no envía correos ni modifica los padrones. Se limita el ritmo de los lotes y comparte el bloqueo del mantenimiento para respetar la cuota de Google Sheets.

Se actualizaron y verificaron las 25 plantillas registradas, conservando sus IDs. Todas contienen AsistenciaPorGrupo. Colonia tiene 11 pestañas de grupos, con A/B separados. Las actividades sin grupos no reciben participantes de muestra: al cargar sus padrones en Muni360, el mismo generador crea sus pestañas automáticamente. La ampliación de comida se aplica únicamente a Colonia, que es la actividad que permite registrarla.

Verificación: 195 pruebas generales y 91 pruebas del servidor aprobadas. Se compararon todas las celdas de las 11 matrices de Colonia con una proyección independiente de Padron y Asistencia: coincidieron. Revisión visual de las fechas, marcas, tres totales y del índice madre en Google Sheets. El grupo 4y5 del 22/11 muestra 31 presentes, 13 con comida y 18 sin comida.

Integridad: se mantuvieron los 285 participantes y las 157 asistencias. Las huellas de ambos conjuntos coincidieron antes y después (`8088b30706fb8722b83bab7a1adfa24a` padrón; `d0722f974e31f746556953ccda94cc87` asistencia). La cola de sincronización terminó en cero pendientes.
