# Muni360: continuar desde otra PC

Rama de trabajo: `revision/muni360-apps-script-cero-20261110`.
La rama main del sitio no se modifica en esta etapa.

## Estado al 10/11/2026

- Candidato Apps Script v3: Google/Firebase Spark, originales en Sheets privado y vistas por actividad.
- Paquete aplicado en una copia real del repositorio en Windows: `C:\Users\Juan\Projects\ugiccba-site`.
- Git, Node y VS Code disponibles. Se agrega comprobación de portabilidad de finales de línea Windows/Linux.
- Servicios reales de Google todavía sin configurar ni probar; la demo sigue siendo ficticia.
- No activar facturación, Cloud Run ni Firestore. No copiar secretos en GitHub.

## Primera vez en la otra PC

Con Git y Node instalados, abrir una terminal en la carpeta de proyectos:

```text
git clone --branch revision/muni360-apps-script-cero-20261110 https://github.com/ugiccba-prog/ugiccba-site.git
cd ugiccba-site
npm run test:muni360
code .
```

Si el repositorio ya existe en esa PC, revisar primero `git status`. Con la copia limpia, usar `git fetch origin`, cambiar a esta rama y ejecutar `git pull --ff-only`. Conservar cualquier cambio local antes de cambiar de rama; no usar reset destructivo.

## Para retomar desde este chat

Ejecutar Desktop Commander en la PC elegida, verificarla con la misma cuenta y mantener su terminal abierta. Avisar cuál PC se usará si hay dos conectadas. Los archivos se guardan en GitHub; el acceso a Google se autoriza en cada entorno que lo necesite.

## Próximo paso

Seguir `docs/muni360-operacion.md`: crear el entorno separado de ensayo, configurar Authentication Spark, Sheets API, propietario y copias de planillas. Luego completar `docs/muni360-pruebas-aceptacion.md` con dos cuentas reales. Los ensayos automatizados con Google simulado no reemplazan esa aceptación.

Antes de mover otra vez de PC, confirmar que los últimos cambios estén en un commit y que `git status` indique que la rama está al día con origin.


## Pendiente de publicacion — reintentos escalonados
El cambio 92f3037 agrega espera creciente a los reintentos periodicos del cliente; 113 pruebas aprobadas. Codigo guardado en la rama remota de revision. No esta publicado en Hosting: la API de Firebase devolvio 503 UNAVAILABLE al agregar los archivos y un segundo intento acotado tampoco finalizo. Ambos procesos de deploy se detuvieron; no queda reintento del asistente en segundo plano.
Se comprobo HTTP 200 para el cliente y los dos portales; siguen sirviendo la version anterior sin nextRetryAt ni retry({automatic:true}). La optimizacion backend de lecturas de la version 5 de Apps Script permanece publicada.
La carpeta privada de publicacion de esta PC contiene el frontend actualizado, con la configuracion publica recuperada del sitio vivo y validada contra el proyecto/endpoint de ensayo. Proximo paso: reintentar solo Hosting cuando la API permita publicar y comprobar los tres archivos servidos; no hace falta repetir pruebas manuales de datos ni cambiar Apps Script.


## Publicacion recuperada y horario argentino — 11 de noviembre
Firebase completo la publicacion del horario argentino y los reintentos escalonados que estaban pendientes. Se verifico HTTP 200 y coincidencia exacta con el repositorio en el modulo horario, el cliente de sincronizacion, el editor de permisos y los tres HTML de Deportes, Colonia y administracion. La comprobacion del endpoint de Apps Script tambien fue correcta. Backend de ensayo: deployment existente actualizado a version 6. Suite: 118 pruebas aprobadas. El pendiente anterior de Hosting queda resuelto.
La pagina usa America/Argentina/Buenos_Aires y muestra ARG en los instantes del historial. Los vencimientos se interpretan en Argentina y se envian como UTC. Las proyecciones Cambios/EstadoSync adoptan el formato nuevo en su proxima sincronizacion; no se forzo una escritura sobre datos activos para probarlo. Las paginas ya abiertas necesitan recargarse para cargar el frontend nuevo.

### Prioridades restantes
1. Completar en Google los casos parciales de permisos/privacidad, fallos de guardado y restauracion que la matriz conserva pendientes. Las pruebas locales no sustituyen esos resultados.
2. Medir latencias y cuotas reales con varios profes y volumen representativo en la conexion del club. Simulacion local de 20 profes y 400 participantes aprobada; no garantiza esa capacidad real.
3. Observar varias ejecuciones nocturnas de respaldo/sincronizacion y el espacio libre de Drive. Solo la primera noche tiene confirmacion real; no hay monitoreo del asistente fuera de la conversacion.
4. Revisar estetica, legibilidad y flujo de cancha en celular; recorrer la presentacion completa en el proyector. No se declaran aprobados por haber corregido el backend.
La matriz de aceptacion se actualizo con las confirmaciones que antes estaban solo en notas: cierre sobre copias, primera noche, importacion invalida, comida de Colonia y aislamiento entre actividades.


## Primera estetica de cancha publicada
Cambio 5b5bea5 guardado en la rama de revision y publicado en Firebase Hosting del ensayo. Se comprobo HTTP 200 y contenido exacto del repositorio para CSS compartido y los HTML de ambos portales. Suite: 123 pruebas aprobadas; seis recorridos de navegador local a 360/390/1440 px aprobados. Ver muni360-estetica.md para alcance y reproduccion.
La revision adicional de seguridad no encontro un fallo nuevo en los cinco casos agregados. No se marca como completa la matriz real de Google: sus casos pendientes, el rendimiento con varias cuentas reales, varios dias de respaldo y el proyector siguen diferenciados. Se paso a una primera mejora visual sin alterar ese estado de verificacion.
No quedan procesos de prueba, servidores locales ni reintentos de publicacion del asistente en segundo plano. Las herramientas de navegador de esta revision usaron perfiles nuevos y datos ficticios.


## Vista compacta unica publicada
Cambio 6761aeb publicado y verificado por HTTP con contenido exacto en ambos HTML y CSS compartido. Se retiro el boton Modo cancha; la distribucion compacta es predeterminada. Indicadores plegados al final, ayuda de referencias, cabecera/navegacion reducidas y guardado en flujo normal. Suite: 123 pruebas aprobadas. Se completaron doce recorridos de navegador local con perfiles simulados Direccion/Profe a 360, 390 y 1440 px; las fichas de Profe comienzan a 329 px en Deportes y 379 px en Colonia en las demos moviles. Referencia vigente: muni360-estetica.md.


## Profe sin Cambios y con cuatro pestanas fijas
Cambio e150ee3 publicado y verificado por HTTP con contenido exacto en CSS y ambos portales. Se retiro Cambios de la interfaz operativa; Direccion/Coordinacion conservan la vista. El registro de operaciones del servidor sigue activo. Perfil Profe habitual: Asistencia, Evaluar, Banco UGI y Analisis, en una fila sin scroll horizontal. Suite: 125 pruebas aprobadas y doce recorridos de navegador local, con comprobacion de opciones por perfil y posicion de las cuatro pestanas.
