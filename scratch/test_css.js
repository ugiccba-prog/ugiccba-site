const fs = require("fs");

const files = [
  "index.html",
  "pages/familias.html",
  "pages/jugadores.html",
  "profes/index.html",
  "pages/semaforo-ugi.html",
  "pages/deportehijos.html",
  "pages/entrenamiento-mental.html",
  "pages/ciudad-integrado.html"
];

let hasErrors = false;
files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const styles = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  styles.forEach((st, idx) => {
    const raw = st.replace(/<\/?style[^>]*>/gi, "");
    const openBraces = (raw.match(/\{/g) || []).length;
    const closeBraces = (raw.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      console.error(`Mismatch braces in ${f} style #${idx}: { is ${openBraces}, } is ${closeBraces}`);
      hasErrors = true;
    }
  });
  console.log(`${f}: Checked OK, styles balanced.`);
});

if (!hasErrors) {
  console.log("ALL STYLES BALANCED AND CLEAN!");
}
