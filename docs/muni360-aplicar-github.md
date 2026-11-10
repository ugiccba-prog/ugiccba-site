# Aplicar el paquete en GitHub sin perder el resto del sitio

La integración de esta conversación sólo pudo leer: crear una rama devolvió HTTP 403. Este documento permite aplicar el candidato desde la PC con una cuenta que sí tenga escritura. No se publicó un PR automáticamente.

1. Clonar o actualizar `https://github.com/ugiccba-prog/ugiccba-site` con GitHub Desktop o Git. Conservar cualquier trabajo local ajeno a esta revisión.
2. Crear una rama nueva de revisión, por ejemplo `revision-muni360-appsscript`. No copiar directamente sobre la rama publicada.
3. Extraer el ZIP y copiar **el contenido** de `archivos/` sobre la raíz de esa copia del repositorio, conservando la estructura de carpetas. No reemplazar todo el repositorio por el ZIP: el paquete contiene sólo las piezas de Muni360 y sus guías/pruebas.
4. No subir `.git`, credenciales ni archivos de entorno. La configuración pública se completa en `muni360-config.js`; las propiedades privadas van sólo al proyecto Apps Script.
5. Abrir una terminal en la raíz del repositorio, con Node 22, y ejecutar `npm run test:muni360`. Las pruebas incluidas no necesitan instalar dependencias externas.
6. Revisar los archivos cambiados. Los backends de juegos cognitivos y selectividad no se modifican ni se instalan en el proyecto nuevo de Muni360.
7. Hacer un commit y subir esa rama. Abrir un PR como borrador con resumen de los cambios, las 55 pruebas locales y los ensayos reales todavía pendientes. Usar `docs/muni360-revision.md` como evidencia.
8. Configurar el Apps Script de ensayo con la guía `muni360-operacion.md`. Subir archivos al repositorio no actualiza automáticamente una implementación de Apps Script.
9. Mantener el PR como borrador hasta que pasen los casos críticos reales. Registrar la versión de Apps Script, la URL `/exec`, el commit del sitio y la copia de respaldo usada.
10. Publicar sólo después de revisar esa evidencia. El dominio de prueba debe estar autorizado en Firebase antes del login real.

El commit de referencia pública revisado fue `0aaa985beee36c638832e335fe57c251bf0a9596`. Si la rama publicada cambió después, comparar e integrar los cambios nuevos antes de copiar. El paquete es un candidato completo para revisión, no un parche garantizado contra cualquier versión futura del repositorio.
