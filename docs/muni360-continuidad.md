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
