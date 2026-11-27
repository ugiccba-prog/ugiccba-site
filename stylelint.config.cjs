/** Configuración de stylelint para el sitio UGI. */
module.exports = {
  extends: 'stylelint-config-standard',
  rules: {
    // Estilo compacto de una línea por regla, propio de las hojas de Muni360.
    'declaration-block-single-line-max-declarations': null,
    'rule-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'comment-empty-line-before': null,
    // Sintaxis clásica de media queries: mayor compatibilidad con navegadores viejos.
    'media-feature-range-notation': 'prefix',
    // Nombres de clases e IDs en castellano y con guiones mixtos.
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    // Desactivada a propósito: en estas hojas compara selectores de componentes
    // distintos (p. ej. ".muni-portal select:focus-visible" contra
    // ".portal-period select") y reordenarlos para cumplirla cambiaría la cascada.
    // Se revisaron los 48 casos el 27/11/2026: ninguno es un conflicto real.
    'no-descending-specificity': null,
  },
};
