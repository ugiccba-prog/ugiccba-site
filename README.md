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
* **Portales canónicos:**
  * `muni360/index.html`: Portal de **Deportes** (Hockey sobre Patines, Básquet, Fútbol, Vóley, Rugby y demás disciplinas del club).
  * `muni360cyc/index.html`: Portal de **Colonia y COYFD** (incluye opción de comedor en Colonia).
  * `admin/index.html`: Panel de **Usuarios y permisos** reservado a Dirección UGI.
* **Paquete público publicado en el dominio:** [`https://ugiccba.com.ar/ensayo360muni/`](https://ugiccba.com.ar/ensayo360muni/) (generado desde las fuentes mediante `npm run build:ensayo360`, ver [docs/muni360-dominio.md](docs/muni360-dominio.md)).
* **Capacidades de cancha y gestión:**
  * Registro de Asistencia en vivo con autoguardado, semáforo UGI y cola offline recuperable por cuenta.
  * Evaluaciones técnicas y formativas con decimales, Tarjeta Verde Digital y apoyos DUA.
  * Carga y administración del Padrón de deportistas (con DNI privado en base) e importación/exportación XLSX.
  * Banco de 50 variantes metodológicas UGI y Planificador Express DUA.
  * Archivo consultable de temporadas y cierre del ciclo por rol, con copia previa.

### 3. Aplicaciones Interactivas
* **`apps/training/`**: Módulos interactivos de entrenamiento cognitivo para deportistas:
  * `reaccion.html`: Test de tiempo de reacción e inhibición motriz.
  * `stroop.html`: Test de atención selectiva y agilidad mental.
  * `vision.html`: Test de visión periférica y atención dividida.
* **`ansiedad/index.html`**: Zona de respiración guiada, foco y autorregulación emocional.
* **`hockeysc/index.html`**: Plataforma de Selectividad de Menores para Hockey CCBA.

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
* **Hosting:** GitHub Pages con dominio propio configurado en `CNAME` (`www.ugiccba.com.ar`).


## Muni360 · Supabase, Firebase Auth y Google Sheets (presupuesto cero)

La decisión vigente (corte aprobado el 12/11/2026) utiliza **Supabase (`supabase-1.0.0`)** como API y base privada operativa, **Firebase Authentication (Spark)** para entrar con Google (con opción de recordar sesión) y **Apps Script + Google Sheets/Drive** como trabajador institucional para vistas de consulta, `CargaPadron`, avisos de aprobación y respaldos diarios privados. No se despliega Cloud Run ni Firestore ni se habilita facturación adicional. Sólo el propietario aprueba accesos; los profes cubren todos los equipos de sus actividades habilitadas y cada cambio conserva autor y antes/después.

El ensayo ya fue importado, activado en modo `ready` y publicado en `https://ugiccba.com.ar/ensayo360muni/`. Lo pendiente principal es completar la validación funcional real posterior al corte con cuentas Google reales sobre la matriz de aceptación. `archive/apps-script-v2/` y `server/muni360/` se conservan sólo como referencia histórica.

- [Estado y arquitectura en Supabase](server/supabase/README.md)
- [Publicación en dominio UGI y compilación](docs/muni360-dominio.md)
- [Decisión y costos](docs/muni360-decision.md)
- [Guía de uso del ensayo](docs/muni360-guia-uso.md)
- [Matriz de aceptación en Google](docs/muni360-pruebas-aceptacion.md)
- Comprobaciones: `npm run test:muni360` y `npm run check:ensayo360`.

## Muni360 en el dominio

Entrada: https://ugiccba.com.ar/ensayo360muni/ . Abrir `UGI.code-workspace` en VS Code. Fuentes, compilación, pendientes entre dominios y continuidad entre PC: [docs/muni360-dominio.md](docs/muni360-dominio.md).
