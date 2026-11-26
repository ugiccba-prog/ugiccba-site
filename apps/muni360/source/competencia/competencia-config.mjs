// muni360/competencia/competencia-config.js
export const SPORTS_CONFIG = {
  // --- ARQUETIPO A: Equipo por tiempo, goles/tantos y tarjetas ---
  futbol: {
    label: 'Fútbol',
    activities: ['Fútbol Caballeros', 'Fútbol Damas'],
    archetype: 'A',
    periods: ['1T', '2T'],
    muniActions: [
      { code: 'gol_jugada', label: 'Gol', delta: 1, assist: true },
      { code: 'gol_penal', label: 'Gol Penal', delta: 1 },
      { code: 'gol_tiro_libre', label: 'Gol T. Libre', delta: 1 },
      { code: 'penal_atajado', label: 'Penal Atajado', delta: 0 },
      { code: 'amarilla', label: '🟨 Amarilla', delta: 0, card: 'yellow' },
      { code: 'roja', label: '🟥 Roja', delta: 0, card: 'red' }
    ],
    rivalActions: [
      { code: 'gol_rival', label: '+1 Gol Rival', delta: 1 },
      { code: 'tarjeta_rival', label: 'Tarjeta Rival', delta: 0 }
    ]
  },
  hockey_cesped: {
    label: 'Hockey sobre Césped',
    activities: ['Hockey sobre Césped Caballeros', 'Hockey sobre Césped Damas'],
    archetype: 'A',
    periods: ['1Q', '2Q', '3Q', '4Q'],
    muniActions: [
      { code: 'gol_jugada', label: 'Gol Jugada', delta: 1, assist: true },
      { code: 'gol_corto', label: 'Gol Corto', delta: 1, assist: true },
      { code: 'gol_penal', label: 'Gol Penal', delta: 1 },
      { code: 'corto_favor', label: 'Corto a favor', delta: 0 },
      { code: 'verde', label: '🟩 Verde (2\')', delta: 0, card: 'green' },
      { code: 'amarilla', label: '🟨 Amarilla', delta: 0, card: 'yellow' },
      { code: 'roja', label: '🟥 Roja', delta: 0, card: 'red' }
    ],
    rivalActions: [
      { code: 'gol_rival', label: '+1 Gol Rival', delta: 1 },
      { code: 'corto_rival', label: 'Corto Rival', delta: 0 },
      { code: 'tarjeta_rival', label: 'Tarjeta Rival', delta: 0 }
    ]
  },
  hockey_patines: {
    label: 'Hockey sobre Patines',
    activities: ['Hockey sobre Patines Caballeros', 'Hockey sobre Patines Damas'],
    archetype: 'A',
    periods: ['1T', '2T'],
    alerts: { teamFoulsWarn: 9, teamFoulsTrigger: 10, playerBlueMax: 3 },
    muniActions: [
      { code: 'gol_jugada', label: 'Gol Jugada', delta: 1, assist: true },
      { code: 'gol_penal', label: 'Gol Penal', delta: 1 },
      { code: 'gol_libre', label: 'Gol Libre Dir.', delta: 1 },
      { code: 'falta_equipo', label: 'Falta Equipo', delta: 0, teamFoul: true },
      { code: 'azul', label: '🟦 Azul (2\')', delta: 0, card: 'blue' },
      { code: 'roja', label: '🟥 Roja (4\')', delta: 0, card: 'red' }
    ],
    rivalActions: [
      { code: 'gol_rival', label: '+1 Gol Rival', delta: 1 },
      { code: 'falta_rival', label: 'Falta Rival', delta: 0, teamFoul: true },
      { code: 'tarjeta_rival', label: 'Azul/Roja Rival', delta: 0 }
    ]
  },
  handball: {
    label: 'Handball',
    activities: ['Handball'],
    archetype: 'A',
    periods: ['1T', '2T'],
    alerts: { playerExclusionMax: 3 },
    muniActions: [
      { code: 'gol_jugada', label: 'Gol', delta: 1, assist: true },
      { code: 'gol_7m', label: 'Gol 7m', delta: 1 },
      { code: 'atajada', label: 'Atajada', delta: 0 },
      { code: 'amarilla', label: '🟨 Amarilla', delta: 0, card: 'yellow' },
      { code: 'exclusion_2m', label: '✌️ 2 Minutos', delta: 0, exclusion: true },
      { code: 'roja', label: '🟥 Roja', delta: 0, card: 'red' },
      { code: 'azul', label: '🟦 Azul', delta: 0, card: 'blue' }
    ],
    rivalActions: [
      { code: 'gol_rival', label: '+1 Gol Rival', delta: 1 },
      { code: 'exclusion_rival', label: '2\' / Tarjeta Rival', delta: 0 }
    ]
  },
  rugby: {
    label: 'Rugby',
    activities: ['Rugby Caballeros', 'Rugby Damas'],
    archetype: 'A',
    periods: ['1T', '2T'],
    muniActions: [
      { code: 'try', label: 'Try (+5)', delta: 5 },
      { code: 'conversion', label: 'Conversión (+2)', delta: 2 },
      { code: 'penal', label: 'Penal (+3)', delta: 3 },
      { code: 'drop', label: 'Drop (+3)', delta: 3 },
      { code: 'try_penal', label: 'Try Penal (+7)', delta: 7 },
      { code: 'amarilla', label: '🟨 Sin Bin', delta: 0, card: 'yellow' },
      { code: 'roja', label: '🟥 Roja', delta: 0, card: 'red' }
    ],
    rivalActions: [
      { code: 'try_rival', label: '+5 Try Rival', delta: 5 },
      { code: 'penal_rival', label: '+3 Penal Rival', delta: 3 },
      { code: 'conv_rival', label: '+2 Conv. Rival', delta: 2 },
      { code: 'tarjeta_rival', label: 'Tarjeta Rival', delta: 0 }
    ]
  },

  // --- ARQUETIPO B: Puntos múltiples y faltas personales ---
  basquet: {
    label: 'Básquet',
    activities: ['Básquet Caballeros', 'Básquet Damas'],
    archetype: 'B',
    periods: ['1Q', '2Q', '3Q', '4Q', 'SUP'],
    alerts: { playerFoulMax: 5, quarterTeamFouls: 5 },
    muniActions: [
      { code: 'libre', label: '+1 Libre', delta: 1 },
      { code: 'doble', label: '+2 Doble', delta: 2, assist: true },
      { code: 'triple', label: '+3 Triple', delta: 3, assist: true },
      { code: 'rebote', label: 'Rebote', delta: 0 },
      { code: 'robo', label: 'Robo', delta: 0 },
      { code: 'tapa', label: 'Tapa', delta: 0 },
      { code: 'falta_personal', label: 'Falta Personal', delta: 0, personalFoul: true },
      { code: 'tecnica', label: 'Técnica / Antidep.', delta: 0, personalFoul: true }
    ],
    rivalActions: [
      { code: 'pts1_rival', label: '+1 Rival', delta: 1 },
      { code: 'pts2_rival', label: '+2 Rival', delta: 2 },
      { code: 'pts3_rival', label: '+3 Rival', delta: 3 },
      { code: 'falta_rival', label: 'Falta Rival', delta: 0 }
    ]
  },
  cestoball: {
    label: 'Cestoball',
    activities: ['Cestoball'],
    archetype: 'B',
    periods: ['1T', '2T'],
    alerts: { playerFoulMax: 4 },
    muniActions: [
      { code: 'gol_cancha', label: '+2 Gol Cancha', delta: 2, assist: true },
      { code: 'libre_penal', label: '+1 Libre/Penal', delta: 1 },
      { code: 'falta_personal', label: 'Falta Personal', delta: 0, personalFoul: true },
      { code: 'tecnica', label: 'Técnica / Exp.', delta: 0 }
    ],
    rivalActions: [
      { code: 'pts2_rival', label: '+2 Rival', delta: 2 },
      { code: 'pts1_rival', label: '+1 Rival', delta: 1 },
      { code: 'falta_rival', label: 'Falta Rival', delta: 0 }
    ]
  },

  // --- ARQUETIPO C: Sets, games y tantos ---
  voley: {
    label: 'Vóley',
    activities: ['Vóley Caballeros', 'Vóley Damas'],
    archetype: 'C',
    periods: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
    muniActions: [
      { code: 'pto_ataque', label: '+1 Ataque', delta: 1 },
      { code: 'pto_bloqueo', label: '+1 Bloqueo', delta: 1 },
      { code: 'pto_ace', label: '+1 Ace', delta: 1 },
      { code: 'error_rival', label: '+1 Error Rival', delta: 1, noPlayer: true },
      { code: 'error_propio', label: 'Error Propio', delta: 0 },
      { code: 'tarjeta', label: '🟨/🟥 Tarjeta', delta: 0 }
    ],
    rivalActions: [{ code: 'pto_rival', label: '+1 Punto Rival', delta: 1 }]
  },
  tenis: {
    label: 'Tenis',
    activities: ['Tenis'],
    archetype: 'C',
    periods: ['Set 1', 'Set 2', 'Set 3', 'STB'],
    muniActions: [
      { code: 'game_muni', label: '+1 Game Muni', delta: 1 },
      { code: 'break_favor', label: 'Break a favor', delta: 0 },
      { code: 'ace', label: 'Ace', delta: 0 },
      { code: 'doble_falta', label: 'Doble Falta', delta: 0 }
    ],
    rivalActions: [{ code: 'game_rival', label: '+1 Game Rival', delta: 1 }]
  },
  pelota_paleta: {
    label: 'Pelota Paleta',
    activities: ['Pelota Paleta'],
    archetype: 'C',
    periods: ['Set 1', 'Set 2', 'Set 3'],
    muniActions: [
      { code: 'tanto_muni', label: '+1 Tanto', delta: 1 },
      { code: 'reja', label: '+1 Reja', delta: 1 },
      { code: 'falta_saque', label: 'Falta Saque', delta: 0 },
      { code: 'error_propio', label: 'Error Propio', delta: 0 }
    ],
    rivalActions: [{ code: 'tanto_rival', label: '+1 Tanto Rival', delta: 1 }]
  },

  // --- ARQUETIPO D: Combate ---
  judo: {
    label: 'Judo',
    activities: ['Judo'],
    archetype: 'D',
    periods: ['Combate', 'Golden Score'],
    alerts: { shidoMax: 3 },
    muniActions: [
      { code: 'ippon', label: 'Ippon (Gana)', delta: 10 },
      { code: 'waza_ari', label: 'Waza-ari', delta: 1 },
      { code: 'yuko', label: 'Yuko', delta: 0 },
      { code: 'shido', label: 'Shido', delta: 0 }
    ],
    rivalActions: [
      { code: 'ippon_rival', label: 'Ippon Rival', delta: 10 },
      { code: 'waza_rival', label: 'Waza-ari Rival', delta: 1 },
      { code: 'shido_rival', label: 'Shido Rival', delta: 0 }
    ]
  },
  karate: {
    label: 'Karate',
    activities: ['Karate'],
    archetype: 'D',
    periods: ['Kumite', 'Kata'],
    muniActions: [
      { code: 'ippon', label: 'Ippon (+3)', delta: 3 },
      { code: 'waza_ari', label: 'Waza-ari (+2)', delta: 2 },
      { code: 'yuko', label: 'Yuko (+1)', delta: 1 },
      { code: 'senshu', label: 'Senshu', delta: 0 },
      { code: 'penalizacion', label: 'Penalización WKF', delta: 0 }
    ],
    rivalActions: [
      { code: 'ippon_rival', label: '+3 Rival', delta: 3 },
      { code: 'waza_rival', label: '+2 Rival', delta: 2 },
      { code: 'yuko_rival', label: '+1 Rival', delta: 1 }
    ]
  },

  // --- ARQUETIPO E: Planilla de Torneo (Jueces / Recorrido) ---
  gimnasia_artistica: {
    label: 'Gimnasia Artística',
    activities: ['Gimnasia Artística'],
    archetype: 'E',
    fields: ['Aparato', 'Nota D', 'Nota E', 'Deducciones', 'Nota Final', 'Puesto']
  },
  gimnasia_ritmica: {
    label: 'Gimnasia Rítmica',
    activities: ['Gimnasia Rítmica'],
    archetype: 'E',
    fields: ['Aparato / Conjunto', 'Dificultad', 'Artístico', 'Ejecución', 'Total', 'Puesto']
  },
  patin_artistico: {
    label: 'Patín Artístico',
    activities: ['Patín Artístico'],
    archetype: 'E',
    fields: ['Especialidad', 'Divisional', 'Técnico', 'Componentes', 'Total', 'Puesto']
  },
  natacion_artistica: {
    label: 'Natación Artística',
    activities: ['Natación Artística'],
    archetype: 'E',
    fields: ['Modalidad', 'Elementos', 'Impresión Art.', 'Penalizaciones', 'Total', 'Puesto']
  },
  golf: {
    label: 'Golf',
    activities: ['Golf'],
    archetype: 'E',
    fields: ['Modalidad', 'Cancha / Par', 'Gross', 'Hándicap', 'Neto', 'Puesto']
  }
};
