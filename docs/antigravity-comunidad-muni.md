# Comunidad Muni — Especificación para construir y publicar

## Objetivo

Construir y publicar una sección web llamada **Comunidad Muni** para mostrar avisos deportivos del club y horarios fijos de entrenamiento.

La aplicación debe ser mobile-first, clara, rápida y coherente con la identidad visual existente del sitio.

## Alcance definitivo

### Incluido

- Cartelera pública de avisos.
- Publicaciones de partidos.
- Publicaciones de cambios y suspensiones.
- Avisos generales.
- Horarios fijos de entrenamientos cargados desde archivos del proyecto.
- Filtros por deporte, categoría, equipo y tipo de aviso.
- Login con Google para administrar alertas personales.
- Suscripciones a deporte, categoría o equipo.
- Notificaciones para usuarios suscriptos.
- Panel privado para usuarios autorizados que publican avisos.

### No incluido

- Tabla de horarios en Supabase.
- Tabla separada para partidos.
- Agenda completa de partidos.
- Gestión pública de horarios.
- Exposición de tokens de notificación o suscripciones al navegador.

## Arquitectura recomendada

### Archivos estáticos del proyecto

Crear un archivo como:

```text
comunidad/catalogo.js
```

Debe contener:

- Lista oficial de deportes y actividades.
- Horarios fijos de entrenamiento.
- Categorías generales si son necesarias para los filtros.

Estos datos no son sensibles. Si cambia un horario, se edita el archivo y se vuelve a publicar el sitio.

### Supabase

Usar Supabase únicamente para datos dinámicos:

```text
comunidad.novedades
comunidad.suscripciones
comunidad.dispositivos
```

No crear `comunidad.horarios_base` ni una tabla especial para partidos.

Una publicación de tipo `Partido` es simplemente una fila de `comunidad.novedades`.

## Modelo de publicación

La tabla `comunidad.novedades` debe soportar como mínimo:

- `id`
- `creado_at`
- `autor_uid`
- `autor_nombre`
- `actividad`
- `categoria`
- `equipo`
- `tipo`: `Partido`, `Cambio`, `Suspension`, `Aviso`
- `urgente`
- `titulo`
- `detalle`
- `fecha_evento`
- `hora_evento`
- `lugar`
- `activa`
- `enviar_notificacion`

El valor `enviar_notificacion` debe indicar si la publicación dispara notificaciones a los suscriptores correspondientes.

## Flujo de publicación

1. Un coordinador autorizado inicia sesión.
2. Abre “Publicar aviso”.
3. Selecciona el tipo: Partido, Cambio, Suspensión o Aviso.
4. Selecciona deporte, categoría y equipo.
5. Completa título, detalle, fecha, hora y lugar cuando correspondan.
6. Puede marcar “Enviar notificación”.
7. El backend valida permisos y guarda la publicación.
8. La publicación aparece en la cartelera pública.
9. Si corresponde, se notifica solamente a los usuarios suscriptos al deporte/categoría/equipo.

No duplicar un partido en otra tabla: el aviso es la fuente única de verdad.

## Alertas de usuarios

La tabla `comunidad.suscripciones` debe permitir suscribirse a:

- Todo un deporte.
- Un deporte y categoría.
- Un deporte, categoría y equipo.

La tabla `comunidad.dispositivos` debe almacenar tokens de notificación asociados al usuario autenticado.

## Seguridad obligatoria

- Activar RLS en las tres tablas.
- Las novedades activas y los horarios estáticos pueden ser públicos.
- Suscripciones y dispositivos no deben poder leerse ni escribirse directamente con permisos públicos.
- No exponer nunca `service_role`, claves secretas ni credenciales de backend.
- Las operaciones de guardar suscripciones, registrar dispositivos y publicar avisos deben pasar por una Edge Function o backend seguro.
- Validar en backend que el usuario tenga rol de coordinador antes de permitir publicar.
- No confiar únicamente en validaciones JavaScript del navegador.

### Autenticación

Preferir Supabase Auth con Google para mantener autenticación y autorización dentro de la misma plataforma.

Comunidad Muni debe usar una instancia Firebase con nombre propio (`comunidad`) para no heredar la sesión persistente de Ensayo360 Muni. No cerrar ni reutilizar automáticamente la sesión de otras aplicaciones del mismo proyecto.

Si el proyecto ya depende fuertemente de Firebase Auth, mantener Firebase solo si se implementa un backend que valide el token de Firebase antes de acceder a Supabase. No mezclar Firebase UID con RLS de Supabase de forma directa.

## Interfaz pública

La página debe llamarse:

```text
Comunidad Muni
```

El lenguaje debe ser simple y consistente:

- “Avisos” en lugar de “Comunicados UGI”.
- “Comunidad Muni” en lugar de “Comunidad UGI”.
- No usar “Avisos y Partidos” como sección separada: los partidos son avisos de tipo Partido.
- Mantener una sección separada para “Horarios de entrenamiento”.

Secciones visibles:

1. Avisos.
2. Horarios de entrenamiento.
3. Mis alertas.

Tipos de aviso visibles:

- Partido.
- Cambio.
- Suspensión.
- Aviso.

## Datos estáticos de entrenamiento

El archivo de catálogo debe ser fácil de editar y tener una estructura similar a:

```js
export const HORARIOS_ENTRENAMIENTO = [
  {
    actividad: "Hockey sobre Patines Caballeros",
    categoria: "Sub 12",
    equipo: "A",
    dias: "Martes y Jueves",
    horario: "18:00 a 19:30",
    lugar: "Pista 1"
  }
];
```

No guardar estos horarios en localStorage ni permitir que el público los modifique.

## Correcciones necesarias sobre el prototipo actual

- Corregir todos los textos dañados por codificación, por ejemplo `BÃ¡squet` debe ser `Básquet`.
- Guardar todos los archivos como UTF-8.
- Eliminar datos demo cuando exista conexión real con Supabase.
- No mostrar un usuario falso como “Modo vista previa” cuando el login real esté activo.
- El botón “Continuar con Google” debe ejecutar autenticación real.
- No abrir directamente el panel autenticado sin verificar sesión.
- Reemplazar la persistencia de suscripciones en `localStorage` por persistencia segura en Supabase.
- Mantener `localStorage` únicamente para preferencias visuales no sensibles, si hiciera falta.
- Eliminar la dependencia de `comunidad.horarios_base`.
- Cambiar `Comunicado` por `Aviso` en frontend y base de datos.
- Agregar estado de carga, estado vacío y mensaje de error para Supabase.

## Notificaciones

Implementar notificaciones web únicamente con consentimiento del usuario.

Requisitos:

- Solicitar permiso después de una acción explícita del usuario.
- Registrar el token mediante backend seguro.
- Enviar una notificación solo cuando el autor marque “Enviar notificación”.
- Filtrar destinatarios por actividad, categoría y equipo.
- No enviar notificaciones duplicadas.
- Registrar errores de envío sin impedir que el aviso se publique.

## Data API y RLS

Si el frontend lee novedades directamente mediante Supabase REST:

- Exponer únicamente el esquema necesario en Data API.
- Conceder `SELECT` público solo sobre novedades activas.
- Mantener RLS habilitado.
- No exponer suscripciones ni dispositivos.

Alternativamente, leer novedades mediante una Edge Function si se quiere mantener el esquema fuera de la Data API.

## Criterios de aceptación

La entrega está terminada cuando:

- La página se ve correctamente en móvil y escritorio.
- Todos los textos aparecen con acentos correctos.
- Los horarios fijos se cargan desde el catálogo del proyecto.
- Los filtros de avisos funcionan.
- Un partido se publica como aviso de tipo `Partido`.
- Un aviso puede activar notificaciones.
- Un usuario puede iniciar sesión con Google.
- Un usuario puede crear y eliminar sus alertas.
- Un usuario común no puede publicar avisos.
- Un usuario común no puede leer suscripciones ajenas.
- No hay claves secretas en HTML, JavaScript público ni repositorio.
- RLS está habilitado y probado.
- Se verifican los flujos de publicación, login, suscripción y notificación.
- La versión final queda publicada en el hosting actual del sitio.

## Orden de implementación

1. Corregir encoding y textos de Comunidad Muni.
2. Separar deportes y horarios en `catalogo.js`.
3. Simplificar la interfaz a Avisos, Horarios de entrenamiento y Mis alertas.
4. Ajustar la migración SQL para eliminar `horarios_base` y usar `Aviso`.
5. Conectar lectura pública de novedades.
6. Implementar autenticación Google.
7. Implementar suscripciones seguras.
8. Implementar panel de publicación con autorización.
9. Implementar notificaciones web.
10. Probar seguridad, responsive y publicación final.

## Resultado esperado

Una Comunidad Muni simple de mantener:

- Los horarios fijos se modifican en el código cuando sea necesario.
- Los avisos y partidos se publican desde el panel.
- Los partidos no requieren una tabla especial.
- Las notificaciones salen desde la misma publicación.
- Los datos privados quedan protegidos en Supabase.
