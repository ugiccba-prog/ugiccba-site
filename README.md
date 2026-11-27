# 🏆 UGI - Unidad de Gestión Integral
### Club Ciudad de Buenos Aires

Repositorio oficial del sitio web de la **UGI (Unidad de Gestión Integral)** del **Club Ciudad de Buenos Aires**, plataforma transversal dedicada a la formación integral, la convivencia deportiva y el desarrollo de deportistas, familias y entrenadores.

> *"El entrenamiento que no se ve también se entrena."*

---

## 🎯 Objetivo de la Plataforma
Centralizar los recursos pedagógicos, las herramientas de convivencia y el sistema unificado de gestión de cancha del Club Ciudad de Buenos Aires, garantizando un marco formativo compartido entre deportistas, familias y cuerpo técnico.

---

## 🏛️ Ecosistema y Estructura del Sitio

### 1. Portada y Portales Públicos
* **`index.html`**: Portada principal institucional, con presentación del propósito, programas y acceso a los portales formativos.
* **`pages/jugadores.html`**: Portal de Jugadores con Gimnasio Mental, toma de decisiones, check-in emocional con el Semáforo UGI y guías de desarrollo formativo.
* **`pages/familias.html`**: Portal de Familias con pautas de convivencia deportiva, recomendaciones para acompañar sin presionar y descarga de la guía *"El Otro Equipo"*.
* **`pages/`**:
  * `semaforo-ugi.html`: Guía visual de autorregulación y convivencia en cancha.
  * `deportehijos.html`: El rol de los adultos en el proceso deportivo formativo.
  * `entrenamiento-mental.html`: Manejo de emociones, calma bajo presión y liderazgo (Escuela de Capitanes).
  * `ciudad-integrado.html`: Programa de inclusión, deporte adaptado y pertenencia institucional.

### 2. Gestión Deportiva: Muni 360
* **Paquete público vigente en `main`:** `muni360/`, publicado en `https://ugiccba.com.ar/muni360/` (**39 archivos públicos**).
  * `apps/muni360/source/deportes/index.html` → `/muni360/deportes/`: Portal de **Deportes**.
  * `apps/muni360/source/colonia/index.html` → `/muni360/colonia/` y `/muni360/coyfd/`: Accesos y pantallas independientes para **Colonia** y **COYFD** (empaquetados desde una única fuente con alcance `MUNI_BASE_AREA`, [docs/muni360-portales-separados.md](docs/muni360-portales-separados.md)).
  * `apps/muni360/source/admin/index.html` → `/muni360/admin/`: Panel de **Usuarios y permisos** reservado a Dirección UGI.
  * `apps/muni360/source/encuesta/index.html` → `/muni360/encuesta/`: **Cuestionarios anónimos** para jugadores/as.
  * `muni360/` se genera con `npm run build:muni360-public`; Comunidad conserva sus avisos en `/comunidad/`.
  * Estructura de Google Drive y Planilla Madre oficial (`Club / Muni360`): [docs/muni360-planillas.md](docs/muni360-planillas.md).
* **Capacidades de cancha y gestión:**
  * Registro de Asistencia en vivo con autoguardado, semáforo UGI, navegación Atrás/Adelante entre secciones sin cerrar sesión, indicador desplegable de **Presentes diarios** sin duplicados en Colonia y COYFD ([docs/muni360-presentes-diarios.md](docs/muni360-presentes-diarios.md)) y cola offline recuperable por cuenta.
  * **Planillas horizontales por grupo y tira en Google Sheets:** pestañas `Asist · <grupo> · <tira>` con fechas en columnas, nombres en filas y totales diarios de presentes, con comida y sin comida en Colonia ([docs/muni360-asistencia-horizontal.md](docs/muni360-asistencia-horizontal.md)).
  * Evaluaciones técnicas y formativas con decimales, Tarjeta Verde Digital y apoyos DUA.
  * **Carga e importación profesional de Padrones desde Excel (`ALTA_PADRON_LOTE`):** detección de columnas `Categoría` / `Grupo` y `Tira` / `Equipo` (separando A/B), vista previa por grupo antes de confirmar, validación atómica en lote y exportación XLSX.
  * **Módulo de Inteligencia e IA:** Detección determinística en SQL (`CAIDA_ASISTENCIA`, `AUSENCIAS_CONSECUTIVAS`, `SEMAFORO_ALERTA`), escalamiento automático a 48 h, asistente de análisis con IA y seguimiento de intervenciones.
  * **Cuestionarios anónimos:** Constructor en Coordinación/Dirección con desplegables dinámicos en cascada (Deporte → Categoría → Equipos) y selección múltiple por lote, integrado con las tarjetas de Inteligencia y las planillas oficiales de Sheets.
  * **Modo Demo interactivo (`muni360-demo-runtime.js`):** Habilita Panel de Coordinación, Inteligencia, asistente IA y Cuestionarios con datos sintéticos aislados sin requerir sesión ni modificar la base productiva.
  * Banco de 50 variantes metodológicas UGI y Planificador Express DUA.
  * Archivo consultable de temporadas y cierre del ciclo por rol, con copia previa.

### 3. Aplicaciones Interactivas
* **Gimnasio Mental: estado, cambios, pruebas y despliegue:** [registro de continuidad](docs/gimnasio-mental-continuidad.md), con la identificación del Apps Script activo y su versión publicada.
* **`apps/training/`**: Módulos interactivos de entrenamiento cognitivo para deportistas:
  * `reaccion.html`: Test de tiempo de reacción e inhibición motriz.
  * `stroop.html`: Test de atención selectiva y agilidad mental.
  * `vision.html`: Test de visión periférica y atención dividida.
* **`ansiedad/index.html`**: Zona de respiración guiada, foco y autorregulación emocional.
* **`comunidad/index.html`** (y `/muni360/comunidad/`): Cartelera de avisos, partidos, cambios, suspensiones, horarios habituales y suscripción a alertas.
* **`muni360/encuesta/index.html`**: Cuestionarios anónimos por enlace para jugadores y jugadoras.
* **`archive/hockeysc-deshabilitado/`**: Archivo histórico de la plataforma de Selectividad de Menores para Hockey CCBA (deshabilitada en producción).

---

## ⚙️ Backend y Trabajador Institucional (Supabase + Firebase + Apps Script)

* **Backend activo (`server/supabase/`, `supabase-1.0.0`):** Edge Function `muni360` y base PostgreSQL privada con RLS en **Supabase Free**. Verifica los tokens de **Firebase Authentication (Spark, acceso con Google)** antes de cada operación, aplica control de concurrencia y registra auditoría y recibos de forma atómica. Documentación técnica: [server/supabase/README.md](server/supabase/README.md).
* **Trabajador institucional (`apps-script/` y `server/supabase/`):** Google Apps Script proyecta vistas operativas sin DNI ni legajos privados hacia Google Sheets cada 5 minutos, lee `CargaPadron`, procesa la cola reservada de avisos de acceso por correo y realiza respaldos privados diarios en Google Drive. Los módulos de `apps-script/` conservan además las reglas compartidas para la suite local (`npm run test:muni360`).
* **`Codigo.gs`:** Backend de persistencia y tabla de posiciones de los juegos cognitivos (`apps/training/`).
* **`HockeySelectividad.gs`:** Backend de gestión para la selectividad de hockey.

---

## 🎨 Identidad Visual y Tecnologías
* **Paleta Oficial:** Azul Marino (`#082b49`), Celeste Institucional (`#59bde9`) y Fondo Papel (`#fffdf8`).
* **Tipografías:** *Outfit* (títulos de gran impacto) y *Plus Jakarta Sans* (lectura nítida y moderna).
* **Tecnología:** HTML5 semántico, CSS3 nativo y JavaScript Vanilla sin dependencias pesadas.
* **Hosting:** GitHub Pages con dominio propio configurado en `CNAME` (`ugiccba.com.ar`).


## Muni360 · Supabase, Firebase Auth y Google Sheets (presupuesto cero)

La decisión vigente (corte aprobado el 12/11/2026) utiliza **Supabase (`supabase-1.0.0`)** como API y base privada operativa, **Firebase Authentication (Spark)** para entrar con Google (con opción de recordar sesión) y **Apps Script + Google Sheets/Drive** como trabajador institucional para vistas de consulta, `CargaPadron`, avisos de aprobación y respaldos diarios privados. No se despliega Cloud Run ni Firestore ni se habilita facturación adicional. Sólo el propietario aprueba accesos; en Deportes los profes acceden a los equipos asignados por Dirección o Coordinación y cada cambio conserva autor y antes/después.

El corte a Supabase se mantiene activo y el paquete público `/muni360/` está publicado en `main` (`https://ugiccba.com.ar/muni360/`), respaldado por la estructura ordenada en Google Drive (`Club / Muni360 / Muni360 · Planilla Madre de Control (Oficial)`, `01 · Planillas por Actividad (Oficiales)` y `02 · Respaldos Privados Supabase (No borrar)`). `archive/apps-script-v2/` y `server/muni360/` se conservan en el repositorio únicamente como referencia histórica.

- [Índice de documentación (vigente e histórica)](docs/README.md)
- [Estado y arquitectura en Supabase](server/supabase/README.md)
- [Planillas oficiales y estructura en Google Drive](docs/muni360-planillas.md)
- [Publicación en dominio UGI y compilación](docs/muni360-dominio.md)
- [Decisión y costos](docs/muni360-decision.md)
- [Guía de uso de Muni360](docs/muni360-guia-uso.md)
- [Matriz de aceptación en Google](docs/muni360-pruebas-aceptacion.md)
- Comprobaciones: `npm run test:muni360`, `npm run check:muni360-public`, `npm run lint:js`, `npm run lint:css` y las pruebas del servidor (`node --test server/supabase/tests/*.test.*`, ver [server/supabase/README.md](server/supabase/README.md)).

## Muni360 en el dominio

Ruta oficial publicada en producción: https://ugiccba.com.ar/muni360/. Ver [estado vigente y continuidad](docs/muni360-continuidad.md). Abrir `UGI.code-workspace` en VS Code. Fuentes, compilación y operación continua: [docs/muni360-dominio.md](docs/muni360-dominio.md).

Documentación del módulo privado Competencia: [integración, pruebas y alcance](docs/muni360-competencia.md).
