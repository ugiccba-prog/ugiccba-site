# 🏆 UGI - Unidad de Gestión Integral 
### Club Ciudad de Buenos Aires

Este es el repositorio oficial del sitio web de la **UGI**, un órgano técnico transversal del **Club Ciudad de Buenos Aires** dedicado a la formación integral, la convivencia deportiva y la neurociencia aplicada al rendimiento.

> "El entrenamiento que no se ve también se entrena."

## 🎯 Objetivo del Proyecto
Centralizar y profesionalizar el acceso a herramientas pedagógicas y conductuales para deportistas, familias y formadores del club. El sitio funciona como una plataforma de recursos interactivos y formación continua.

## 🚀 Características del Sitio
- **Diseño Institucional:** Estética alineada con la identidad del Club Ciudad (Navy & Sky Blue).
- **Responsive Design:** Optimizado para notebooks, tablets y dispositivos móviles.
- **Secciones Educativas:** 
    - **Semáforo de la UGI:** Guía visual de autorregulación y convivencia.
    - **Entrenamiento Mental:** Recursos de neurociencia aplicada al deporte.
    - **Ciudad Integrado:** Espacio dedicado a la inclusión y pertenencia.
- **Interactividad:** Integración de juegos didácticos (Educaplay) y material de lectura dinámico (Canva).
- **Portal de Capacitaciones:** Acceso segmentado para Profesores, Familias y Jugadores.

## 🛠️ Tecnologías Utilizadas
- **Frontend:** HTML5 semántico y CSS3 moderno (Custom Properties / Flexbox / Grid).
- **Interactividad:** JavaScript Vanilla (Intersection Observer para animaciones de revelado).
- **Recursos Externos:** 
    - Embeds de Canva (Material de lectura).
    - Embeds de Educaplay (Dinámicas de juego).
    - Google Forms (Registro de capacitaciones).

## 📂 Estructura del Repositorio
- `index.html`: Punto de entrada principal y landing page integral.
- `pages/`: Páginas públicas agrupadas por contenido.
- `apps/training/`: Aplicaciones interactivas de entrenamiento.
  `reaccion.html` es la app de reacción con cámara, una sola para celular y
  escritorio: se adapta al tamaño de pantalla. `index.html` y `mobile.html`
  quedaron como redirecciones para no romper links viejos.
  `vision.html` es el test de visión periférica (doble tarea con destello y
  máscara, y escalera adaptativa que busca el umbral en milisegundos).
  Los juegos (`stroop.html`, `reaccion.html`, `vision.html`) comparten
  `apps/training/ugi-envio.js`: ahí está la URL del Apps Script, el perfil del
  jugador y la cola offline. Cualquier juego nuevo de esta carpeta tiene que
  cargarlo con `<script src="./ugi-envio.js"></script>` antes de su propio script.
- `assets/images/`: Logos, favicon e imágenes editoriales.
- `assets/styles/`: Hojas de estilo compartidas del sitio.
- `assets/scripts/`: JavaScript compartido del sitio.
- `apps-script/Codigo.gs`: el Apps Script que guarda los resultados en la
  planilla y devuelve el top 10 de la tabla de posiciones. Incluye arriba los
  pasos para implementarlo; al final hay que pegar la URL `/exec` en
  `apps/training/ugi-envio.js`.
- `assets/scripts/ranking.js`: tabla de posiciones del portal de jugadores.
- `CNAME`: Configuración del dominio de GitHub Pages.

Las páginas y aplicaciones nuevas deben enlazarse desde sus carpetas organizadas. Las
copias HTML en la raíz y `training-app/` son redirecciones de compatibilidad para
conservar las URLs publicadas anteriormente.

## 🔧 Instalación y Desarrollo Local
Si deseas visualizar el proyecto localmente:
1. Clona el repositorio:
   ```bash
   git clone https://github.com/ugiccba-prog/ugiccba-site.git