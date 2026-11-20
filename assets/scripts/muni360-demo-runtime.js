(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MuniDemoRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const SURVEYS_KEY = 'muni360_demo_surveys_v1';
  const CASES_KEY = 'muni360_demo_cases_v1';

  let memSurveys = null;
  let memCases = null;

  const sortText = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { numeric: true });
  const round1 = n => Math.round(n * 10) / 10;
  const round2 = n => Math.round(n * 100) / 100;

  function readLocal(key) {
    try {
      const raw = root.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeLocal(key, val) {
    try {
      root.localStorage?.setItem(key, JSON.stringify(val));
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeLocal(key) {
    try {
      root.localStorage?.removeItem(key);
    } catch (_) {}
  }

  function readActivityCache(activity) {
    const key = 'muni360_cache_' + activity;
    try {
      const sRaw = root.sessionStorage?.getItem(key);
      if (sRaw) return JSON.parse(sRaw);
    } catch (_) {}
    const lVal = readLocal(key);
    return lVal && typeof lVal === 'object' ? lVal : { padron: [], asistencia: [], evaluaciones: [], sesiones: [] };
  }

  function argToday(nowMs) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(nowMs));
  }

  function shiftIso(nowMs, deltaHours) {
    return new Date(nowMs + deltaHours * 3600000).toISOString();
  }

  function seedSurveys(nowMs = Date.now()) {
    return [
      {
        id: 'demo-sv-basquet-clima',
        public_code: 'demo_basquet_clima',
        activity: 'Básquet Caballeros',
        categoria: 'Sub-12 Demo',
        equipo: 'A',
        title: 'Clima y bienestar del grupo',
        description: 'Cuestionario 100% anónimo para conocer cómo te sentís entrenando en el club.',
        status: 'active',
        created_at: shiftIso(nowMs, -72),
        updated_at: shiftIso(nowMs, -12),
        questions: [
          { id: 'q1', type: 'scale', label: '¿Cómo te sentís con el grupo y tus compañeros/as?', required: true },
          { id: 'q2', type: 'scale', label: '¿Qué tan cómodo/a te sentís con el cuerpo técnico?', required: true },
          { id: 'q3', type: 'scale', label: '¿Te resultan cómodos los días y horarios de entrenamiento?', required: true },
          { id: 'q4', type: 'text', label: '¿Qué mejorarías o qué te gustaría sumar este mes?', required: false }
        ],
        responses: [
          { q1: 5, q2: 5, q3: 4, q4: 'Muy buen clima en los entrenamientos.' },
          { q1: 5, q2: 4, q3: 5, q4: 'Me gustaría hacer más partidos los sábados.' },
          { q1: 4, q2: 5, q3: 4, q4: 'El grupo acompaña muy bien.' },
          { q1: 4, q2: 4, q3: 4, q4: '' },
          { q1: 5, q2: 5, q3: 5, q4: '' }
        ]
      },
      {
        id: 'demo-sv-basquet-ausencias',
        public_code: 'demo_basquet_aus',
        activity: 'Básquet Caballeros',
        categoria: 'Sub-14',
        equipo: 'A',
        title: 'Motivos de inasistencia',
        description: 'Contanos de forma anónima si algo te dificulta venir a entrenar.',
        status: 'active',
        created_at: shiftIso(nowMs, -36),
        updated_at: shiftIso(nowMs, -5),
        questions: [
          {
            id: 'q1',
            type: 'multi',
            label: 'Si faltaste en las últimas semanas, ¿por qué fue?',
            options: ['Horarios de estudio/trabajo', 'Transporte o distancia', 'Cansancio o lesión', 'Clima', 'Motivos personales', 'No falté'],
            required: true
          },
          { id: 'q2', type: 'scale', label: '¿Cuántas ganas tenés de seguir viniendo este año?', required: true },
          { id: 'q3', type: 'text', label: '¿Hay algo en lo que el club o el profe pueda ayudarte?', required: false }
        ],
        responses: [
          { q1: ['Horarios de estudio/trabajo'], q2: 2, q3: 'Salgo tarde del colegio los martes.' },
          { q1: ['Horarios de estudio/trabajo', 'Transporte o distancia'], q2: 3, q3: 'Sería útil arrancar 30 min más tarde.' },
          { q1: ['Cansancio o lesión'], q2: 2, q3: '' },
          { q1: ['No falté'], q2: 4, q3: 'Todo bien con el grupo.' }
        ]
      },
      {
        id: 'demo-sv-hockey-cierre',
        public_code: 'demo_hockey_cierre',
        activity: 'Hockey sobre Césped Damas',
        categoria: '',
        equipo: '',
        title: 'Balance de etapa',
        description: 'Tu opinión anónima nos ayuda a planificar la próxima temporada.',
        status: 'active',
        created_at: shiftIso(nowMs, -96),
        updated_at: shiftIso(nowMs, -24),
        questions: [
          { id: 'q1', type: 'scale', label: 'En general, ¿cómo evaluás tu experiencia en esta etapa?', required: true },
          { id: 'q2', type: 'single', label: '¿Pensás continuar en la actividad el próximo período?', options: ['Sí, seguro', 'Todavía no lo sé', 'Probablemente no'], required: true },
          { id: 'q3', type: 'text', label: '¿Qué fue lo mejor y qué cambiarías?', required: false }
        ],
        responses: [
          { q1: 5, q2: 'Sí, seguro', q3: 'El equipo está muy unido.' },
          { q1: 4, q2: 'Sí, seguro', q3: 'Sumaría más trabajos de definición.' },
          { q1: 5, q2: 'Sí, seguro', q3: '' },
          { q1: 4, q2: 'Todavía no lo sé', q3: 'Depende del horario de facultad.' }
        ]
      },
      {
        id: 'demo-sv-colonia-clima',
        public_code: 'demo_colonia_clima',
        activity: 'Colonia',
        categoria: 'Grupo 8 años',
        equipo: 'General',
        title: 'Clima y disfrute en Colonia',
        description: 'Cuestionario breve para conocer cómo la pasan los chicos en el grupo.',
        status: 'active',
        created_at: shiftIso(nowMs, -48),
        updated_at: shiftIso(nowMs, -10),
        questions: [
          { id: 'q1', type: 'scale', label: '¿Qué tanto disfrutaste las actividades de la semana?', required: true },
          { id: 'q2', type: 'scale', label: '¿Cómo te sentiste con tus compañeros y profes?', required: true },
          { id: 'q3', type: 'text', label: '¿Qué juego o actividad te gustó más?', required: false }
        ],
        responses: [
          { q1: 5, q2: 5, q3: 'Los juegos en la pileta.' },
          { q1: 4, q2: 5, q3: 'Búsqueda del tesoro en el playón.' },
          { q1: 4, q2: 4, q3: '' },
          { q1: 5, q2: 4, q3: 'Jugar al quemado con todo el grupo.' }
        ]
      },
      {
        id: 'demo-sv-coyfd-adaptacion',
        public_code: 'demo_coyfd_adapt',
        activity: 'COYFD',
        categoria: 'Grupo 9-10 años',
        equipo: 'General',
        title: 'Adaptación e integración en grupo',
        description: 'Opinión anónima sobre tiempos, consignas y comodidad en el espacio.',
        status: 'active',
        created_at: shiftIso(nowMs, -60),
        updated_at: shiftIso(nowMs, -4),
        questions: [
          { id: 'q1', type: 'scale', label: '¿Cómo te sentís integrado/a en las actividades del grupo?', required: true },
          { id: 'q2', type: 'scale', label: '¿Cómo te resultan los tiempos y consignas de clase?', required: true },
          { id: 'q3', type: 'text', label: '¿Qué te ayudaría a sentirte aún más cómodo/a?', required: false }
        ],
        responses: [
          { q1: 2, q2: 3, q3: 'A veces hay mucho ruido al cambiar de estación.' },
          { q1: 3, q2: 3, q3: 'Me ayudan los tableros visuales antes de empezar.' },
          { q1: 4, q2: 3, q3: '' }
        ]
      }
    ];
  }

  function seedCases(nowMs = Date.now()) {
    return [
      {
        id: 'demo-case-1',
        case_key: 'Básquet Caballeros|AUSENCIAS_CONSECUTIVAS|Sub-12 Demo|A',
        activity: 'Básquet Caballeros',
        categoria: 'Sub-12 Demo',
        equipo: 'A',
        rule_code: 'AUSENCIAS_CONSECUTIVAS',
        severity: 'media',
        status: 'abierta',
        title: '1 integrante(s) con 3+ ausencias seguidas en Sub-12 Demo · A',
        summary: 'Se detectó 1 integrante con 3 ausencias consecutivas en los últimos 45 días.',
        metrics: {
          count: 1,
          maxStreak: 3,
          jugadores: [{ nombre: 'Domínguez, Lucas', racha: 3 }]
        },
        notes: [],
        opened_at: shiftIso(nowMs, -18),
        due_at: shiftIso(nowMs, 30),
        updated_at: shiftIso(nowMs, -18)
      },
      {
        id: 'demo-case-2',
        case_key: 'Básquet Caballeros|SEMAFORO_ALERTA|Sub-12 Demo|A',
        activity: 'Básquet Caballeros',
        categoria: 'Sub-12 Demo',
        equipo: 'A',
        rule_code: 'SEMAFORO_ALERTA',
        severity: 'media',
        status: 'escalada',
        title: 'Alerta de semáforo en Sub-12 Demo · A',
        summary: '4 observaciones amarillas/rojas sobre 20 en los últimos 21 días (🟡3 🔴1).',
        metrics: { observados: 20, amarillo: 3, rojo: 1 },
        notes: [
          {
            at: shiftIso(nowMs, -20),
            autor: 'Coordinación Básquet (Demo)',
            rol: 'Coordinación',
            action: 'en_revision',
            note: 'Se observó frustración en cierre de práctica; se acordó seguimiento con profe.'
          }
        ],
        opened_at: shiftIso(nowMs, -54),
        due_at: shiftIso(nowMs, -6),
        escalated_at: shiftIso(nowMs, -6),
        updated_at: shiftIso(nowMs, -6)
      },
      {
        id: 'demo-case-3',
        case_key: 'Básquet Caballeros|CUESTIONARIO_ALERTA|demo-sv-basquet-ausencias',
        activity: 'Básquet Caballeros',
        categoria: 'Sub-14',
        equipo: 'A',
        rule_code: 'CUESTIONARIO_ALERTA',
        severity: 'media',
        status: 'en_revision',
        title: 'Señal en cuestionario: Motivos de inasistencia',
        summary: 'Promedio de escala 2.75 / 5 en 4 respuesta(s) (2 valoración(es) baja(s) ≤ 2).',
        metrics: { surveyId: 'demo-sv-basquet-ausencias', responseCount: 4, avgScale: 2.75, lowCount: 2 },
        notes: [
          {
            at: shiftIso(nowMs, -5),
            autor: 'Juan Machado',
            rol: 'Dirección UGI',
            action: 'en_revision',
            note: 'Revisando superposición horaria escolar mencionada en el cuestionario anónimo.'
          }
        ],
        opened_at: shiftIso(nowMs, -26),
        due_at: shiftIso(nowMs, 22),
        updated_at: shiftIso(nowMs, -5)
      },
      {
        id: 'demo-case-4',
        case_key: 'Hockey sobre Césped Damas|CAIDA_ASISTENCIA|Sub-12|B',
        activity: 'Hockey sobre Césped Damas',
        categoria: 'Sub-12',
        equipo: 'B',
        rule_code: 'CAIDA_ASISTENCIA',
        severity: 'media',
        status: 'intervenida',
        title: 'Caída de asistencia en Sub-12 · B',
        summary: 'Asistencia reciente 55% (6 reg.) frente a 82% en las 4 semanas previas.',
        metrics: { recentPct: 55, recentReg: 6, baselinePct: 82, baselineReg: 8 },
        notes: [
          {
            at: shiftIso(nowMs, -3),
            autor: 'Coordinación Hockey (Demo)',
            rol: 'Coordinación',
            action: 'intervenida',
            note: 'Se comunicó ajuste de horario por lluvia con las familias vía Comunidad.'
          }
        ],
        opened_at: shiftIso(nowMs, -30),
        due_at: shiftIso(nowMs, 18),
        updated_at: shiftIso(nowMs, -3)
      },
      {
        id: 'demo-case-5',
        case_key: 'Colonia|SEMAFORO_ALERTA|Grupo 8 años|General',
        activity: 'Colonia',
        categoria: 'Grupo 8 años',
        equipo: 'General',
        rule_code: 'SEMAFORO_ALERTA',
        severity: 'media',
        status: 'abierta',
        title: 'Alerta de semáforo en Grupo 8 años · General',
        summary: '2 observaciones amarillas sobre 10 en los últimos 21 días (🟡2 🔴0).',
        metrics: { observados: 10, amarillo: 2, rojo: 0 },
        notes: [],
        opened_at: shiftIso(nowMs, -12),
        due_at: shiftIso(nowMs, 36),
        updated_at: shiftIso(nowMs, -12)
      },
      {
        id: 'demo-case-6',
        case_key: 'COYFD|CUESTIONARIO_ALERTA|demo-sv-coyfd-adaptacion',
        activity: 'COYFD',
        categoria: 'Grupo 9-10 años',
        equipo: 'General',
        rule_code: 'CUESTIONARIO_ALERTA',
        severity: 'media',
        status: 'escalada',
        title: 'Señal en cuestionario: Adaptación e integración en grupo',
        summary: 'Promedio de escala 3 / 5 en 3 respuesta(s) (1 valoración(es) baja(s) ≤ 2).',
        metrics: { surveyId: 'demo-sv-coyfd-adaptacion', responseCount: 3, avgScale: 3, lowCount: 1 },
        notes: [],
        opened_at: shiftIso(nowMs, -52),
        due_at: shiftIso(nowMs, -4),
        escalated_at: shiftIso(nowMs, -4),
        updated_at: shiftIso(nowMs, -4)
      }
    ];
  }

  function loadSurveys() {
    const stored = readLocal(SURVEYS_KEY);
    if (Array.isArray(stored)) {
      memSurveys = stored;
      return memSurveys;
    }
    if (!Array.isArray(memSurveys)) {
      memSurveys = seedSurveys();
      writeLocal(SURVEYS_KEY, memSurveys);
    }
    return memSurveys;
  }

  function saveSurveys(list) {
    memSurveys = list;
    writeLocal(SURVEYS_KEY, list);
  }

  function loadCases() {
    const stored = readLocal(CASES_KEY);
    if (Array.isArray(stored)) {
      memCases = stored;
      return memCases;
    }
    if (!Array.isArray(memCases)) {
      memCases = seedCases();
      writeLocal(CASES_KEY, memCases);
    }
    return memCases;
  }

  function saveCases(list) {
    memCases = list;
    writeLocal(CASES_KEY, list);
  }

  function clear() {
    memSurveys = null;
    memCases = null;
    removeLocal(SURVEYS_KEY);
    removeLocal(CASES_KEY);
  }

  function reset() {
    const nowMs = Date.now();
    const s = seedSurveys(nowMs);
    const c = seedCases(nowMs);
    saveSurveys(s);
    saveCases(c);
  }

  function summarizeSurvey(survey) {
    const questions = Array.isArray(survey.questions) ? survey.questions : [];
    const responses = Array.isArray(survey.responses) ? survey.responses : [];
    const summary = questions.map(q => {
      if (q.type === 'scale') {
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0, count = 0;
        for (const r of responses) {
          const n = Number(r?.[q.id]);
          if (Number.isInteger(n) && n >= 1 && n <= 5) {
            dist[n]++;
            sum += n;
            count++;
          }
        }
        return { id: q.id, type: q.type, label: q.label, count, avg: count ? round2(sum / count) : null, distribution: dist };
      }
      if (q.type === 'single' || q.type === 'multi') {
        const counts = {};
        for (const opt of q.options || []) counts[opt] = 0;
        let count = 0;
        for (const r of responses) {
          const val = r?.[q.id];
          const picked = q.type === 'multi'
            ? (Array.isArray(val) ? val : [])
            : (typeof val === 'string' && val ? [val] : []);
          let any = false;
          for (const p of picked) {
            if (p in counts) {
              counts[p]++;
              any = true;
            }
          }
          if (any) count++;
        }
        return { id: q.id, type: q.type, label: q.label, count, counts };
      }
      const texts = [];
      for (const r of responses) {
        const t = typeof r?.[q.id] === 'string' ? r[q.id].trim() : '';
        if (t) texts.push(t);
      }
      return { id: q.id, type: q.type, label: q.label, count: texts.length, texts: texts.slice(0, 100) };
    });
    const { responses: _, ...rest } = survey;
    return { ...rest, responseCount: responses.length, summary };
  }

  function semaforoMetrics(registros) {
    const counts = { verde: 0, amarillo: 0, rojo: 0 };
    for (const r of registros) {
      const m = String(r.estado || '').match(/Sem:([VAR])/);
      if (m) counts[{ V: 'verde', A: 'amarillo', R: 'rojo' }[m[1]]]++;
    }
    const observados = counts.verde + counts.amarillo + counts.rojo;
    return {
      ...counts,
      observados,
      promedio: observados ? round2((counts.verde * 3 + counts.amarillo * 2 + counts.rojo) / observados) : null,
      pctVerde: observados ? round1(counts.verde / observados * 100) : null
    };
  }

  function groupMetrics(inscripciones, registros) {
    const presentes = registros.filter(r => ['P', 'T'].includes(String(r.estado || '').charAt(0))).length;
    return {
      inscripciones,
      registros: registros.length,
      presentes,
      asistencia: registros.length ? round1(presentes / registros.length * 100) : null,
      semaforo: semaforoMetrics(registros)
    };
  }

  function summarizeActivityDashboard(activity, state, days, nowMs) {
    const data = state || {};
    const today = argToday(nowMs);
    const start = days ? new Date(Date.parse(today + 'T12:00:00Z') - (days - 1) * 86400000).toISOString().slice(0, 10) : '0000-01-01';
    const inPeriod = r => typeof r?.fecha === 'string' && r.fecha >= start && r.fecha <= today;
    const attendance = (data.asistencia || []).filter(inPeriod);
    const evaluations = (data.evaluaciones || []).filter(inPeriod);
    const roster = data.padron || [];
    const sesiones = data.sesiones || [];
    const sums = {
      inscripciones: roster.length,
      grupos: new Set(roster.map(p => JSON.stringify([p.categoria, p.equipo]))).size,
      registros: 0,
      presentes: 0,
      ausentes: 0,
      sinRegistrar: 0,
      observaciones: 0,
      alertas: 0,
      evaluaciones: evaluations.length,
      notas: 0,
      sumaNotas: 0,
      sesiones: sesiones.filter(inPeriod).length
    };
    for (const r of attendance) {
      const e = String(r.estado || ''), code = e.charAt(0);
      if (['P', 'T', 'A'].includes(code)) {
        sums.registros++;
        if (code !== 'A') sums.presentes++;
        else sums.ausentes++;
      } else {
        sums.sinRegistrar++;
      }
      if (/Sem:[VAR]/.test(e)) sums.observaciones++;
      if (/Sem:[AR]/.test(e)) sums.alertas++;
    }
    for (const r of evaluations) {
      for (const n of Object.values(r.notas || {})) {
        if (typeof n === 'number' && Number.isFinite(n)) {
          sums.notas++;
          sums.sumaNotas += n;
        }
      }
    }
    const byGroup = new Map();
    const ensure = (categoria, tira) => {
      const k = JSON.stringify([categoria, tira]);
      if (!byGroup.has(k)) byGroup.set(k, { categoria, tira, inscripciones: 0, attendance: [] });
      return byGroup.get(k);
    };
    for (const p of roster) ensure(String(p.categoria || 'Sin categoría'), String(p.equipo || 'General')).inscripciones++;
    for (const r of attendance) ensure(String(r.categoria || 'Sin categoría'), String(r.equipo || 'General')).attendance.push(r);
    const gruposDetalle = [...byGroup.values()]
      .map(g => ({ categoria: g.categoria, tira: g.tira, ...groupMetrics(g.inscripciones, g.attendance) }))
      .sort((a, b) => sortText(a.categoria, b.categoria) || sortText(a.tira, b.tira));
    const categorias = new Map();
    for (const g of gruposDetalle) {
      let c = categorias.get(g.categoria);
      if (!c) categorias.set(g.categoria, c = { categoria: g.categoria, inscripciones: 0, attendance: [] });
      c.inscripciones += g.inscripciones;
      c.attendance.push(...byGroup.get(JSON.stringify([g.categoria, g.tira])).attendance);
    }
    const categoriasDetalle = [...categorias.values()]
      .map(c => ({ categoria: c.categoria, ...groupMetrics(c.inscripciones, c.attendance) }))
      .sort((a, b) => sortText(a.categoria, b.categoria));
    return {
      activity,
      ...sums,
      asistencia: sums.registros ? round1(sums.presentes / sums.registros * 100) : null,
      promedio: sums.notas ? round2(sums.sumaNotas / sums.notas) : null,
      semaforo: semaforoMetrics(attendance),
      gruposDetalle,
      categoriasDetalle
    };
  }

  function scanActivityCases(activity, nowMs) {
    const cases = loadCases();
    const surveys = loadSurveys().filter(s => s.activity === activity && (s.status === 'active' || s.status === 'closed'));
    const cache = readActivityCache(activity);
    const today = argToday(nowMs);
    const d45 = new Date(Date.parse(today + 'T12:00:00Z') - 45 * 86400000).toISOString().slice(0, 10);
    const d21 = new Date(Date.parse(today + 'T12:00:00Z') - 20 * 86400000).toISOString().slice(0, 10);
    const d14 = new Date(Date.parse(today + 'T12:00:00Z') - 13 * 86400000).toISOString().slice(0, 10);
    const d42 = new Date(Date.parse(today + 'T12:00:00Z') - 41 * 86400000).toISOString().slice(0, 10);
    const rows = (cache.asistencia || []).filter(r => typeof r?.fecha === 'string' && r.fecha >= d45 && r.fecha <= today);

    const detected = [];
    const byGroup = new Map();
    const byPlayer = new Map();
    for (const r of rows) {
      const cat = String(r.categoria || 'Sin categoría').trim() || 'Sin categoría';
      const eq = String(r.equipo || 'General').trim() || 'General';
      const gk = cat + '\0' + eq;
      if (!byGroup.has(gk)) byGroup.set(gk, { cat, eq, rows: [] });
      byGroup.get(gk).rows.push(r);

      const code = String(r.estado || '').charAt(0);
      const jug = String(r.jugador || '').trim();
      if (['P', 'T', 'A'].includes(code) && jug) {
        const pk = gk + '\0' + jug;
        if (!byPlayer.has(pk)) byPlayer.set(pk, { cat, eq, jug, rows: [] });
        byPlayer.get(pk).rows.push({ fecha: r.fecha, code });
      }
    }

    for (const g of byGroup.values()) {
      let recReg = 0, recPres = 0, baseReg = 0, basePres = 0;
      let obs = 0, ama = 0, rojo = 0;
      for (const r of g.rows) {
        const code = String(r.estado || '').charAt(0);
        if (['P', 'T', 'A'].includes(code)) {
          if (r.fecha >= d14) {
            recReg++;
            if (code !== 'A') recPres++;
          } else if (r.fecha >= d42) {
            baseReg++;
            if (code !== 'A') basePres++;
          }
        }
        if (r.fecha >= d21) {
          const mSem = String(r.estado || '').match(/Sem:([VAR])/);
          if (mSem) {
            obs++;
            if (mSem[1] === 'A') ama++;
            else if (mSem[1] === 'R') rojo++;
          }
        }
      }
      if (recReg >= 2) {
        const recPct = round1(recPres * 100 / recReg);
        const basePct = baseReg >= 4 ? round1(basePres * 100 / baseReg) : null;
        if ((basePct != null && recPct <= basePct - 20) || recPct < 60) {
          detected.push({
            case_key: `${activity}|CAIDA_ASISTENCIA|${g.cat}|${g.eq}`,
            activity,
            categoria: g.cat,
            equipo: g.eq,
            rule_code: 'CAIDA_ASISTENCIA',
            severity: recPct < 50 || (basePct != null && basePct - recPct >= 30) ? 'alta' : 'media',
            title: `Caída de asistencia en ${g.cat} · ${g.eq}`,
            summary: `Asistencia reciente ${recPct}% (${recReg} reg.)${basePct != null ? ` frente a ${basePct}% en las 4 semanas previas.` : '.'}`,
            metrics: { recentPct: recPct, recentReg: recReg, baselinePct: basePct, baselineReg: baseReg }
          });
        }
      }
      if (obs >= 3 && (rojo >= 2 || (ama + rojo) / obs >= 0.2)) {
        detected.push({
          case_key: `${activity}|SEMAFORO_ALERTA|${g.cat}|${g.eq}`,
          activity,
          categoria: g.cat,
          equipo: g.eq,
          rule_code: 'SEMAFORO_ALERTA',
          severity: rojo >= 2 || (rojo * 100 / obs) >= 35 ? 'alta' : 'media',
          title: `Alerta de semáforo en ${g.cat} · ${g.eq}`,
          summary: `${ama + rojo} observaciones amarillas/rojas sobre ${obs} en los últimos 21 días (🟡${ama} 🔴${rojo}).`,
          metrics: { observados: obs, amarillo: ama, rojo }
        });
      }
    }

    const consecByGroup = new Map();
    for (const p of byPlayer.values()) {
      p.rows.sort((a, b) => b.fecha.localeCompare(a.fecha));
      let streak = 0;
      for (const r of p.rows) {
        if (r.code === 'A') streak++;
        else break;
      }
      if (streak >= 3) {
        const gk = p.cat + '\0' + p.eq;
        if (!consecByGroup.has(gk)) consecByGroup.set(gk, { cat: p.cat, eq: p.eq, jugadores: [] });
        consecByGroup.get(gk).jugadores.push({ nombre: p.jug, racha: streak });
      }
    }
    for (const g of consecByGroup.values()) {
      g.jugadores.sort((a, b) => b.racha - a.racha || sortText(a.nombre, b.nombre));
      const maxStreak = g.jugadores[0].racha;
      detected.push({
        case_key: `${activity}|AUSENCIAS_CONSECUTIVAS|${g.cat}|${g.eq}`,
        activity,
        categoria: g.cat,
        equipo: g.eq,
        rule_code: 'AUSENCIAS_CONSECUTIVAS',
        severity: g.jugadores.length >= 3 || maxStreak >= 5 ? 'alta' : 'media',
        title: `${g.jugadores.length} integrante(s) con 3+ ausencias seguidas en ${g.cat} · ${g.eq}`,
        summary: `Se detectaron ${g.jugadores.length} integrante(s) con al menos 3 ausencias consecutivas en los últimos 45 días.`,
        metrics: { count: g.jugadores.length, maxStreak, jugadores: g.jugadores }
      });
    }

    for (const s of surveys) {
      const scaleQs = (s.questions || []).filter(q => q.type === 'scale');
      if (!scaleQs.length) continue;
      let sum = 0, cnt = 0, low = 0, respCount = 0;
      for (const r of s.responses || []) {
        let had = false;
        for (const q of scaleQs) {
          const n = Number(r?.[q.id]);
          if (Number.isInteger(n) && n >= 1 && n <= 5) {
            sum += n;
            cnt++;
            if (n <= 2) low++;
            had = true;
          }
        }
        if (had) respCount++;
      }
      if (!cnt) continue;
      const avg = round2(sum / cnt);
      if (avg < 3.2 || low >= 2) {
        detected.push({
          case_key: `${activity}|CUESTIONARIO_ALERTA|${s.id}`,
          activity,
          categoria: s.categoria || '',
          equipo: s.equipo || '',
          rule_code: 'CUESTIONARIO_ALERTA',
          severity: avg < 2.5 || low >= 3 ? 'alta' : 'media',
          title: `Señal en cuestionario: ${s.title}`,
          summary: `Promedio de escala ${avg} / 5 en ${respCount} respuesta(s) (${low} valoración(es) baja(s) ≤ 2).`,
          metrics: { surveyId: s.id, responseCount: respCount, avgScale: avg, lowCount: low }
        });
      }
    }

    const nowIso = new Date(nowMs).toISOString();
    const dueIso = shiftIso(nowMs, 48);
    let upserted = 0;
    for (const d of detected) {
      const existing = cases.find(c => c.case_key === d.case_key && c.status !== 'resuelta');
      if (existing) {
        existing.severity = d.severity;
        existing.title = d.title;
        existing.summary = d.summary;
        existing.metrics = d.metrics;
        existing.updated_at = nowIso;
      } else {
        cases.unshift({
          id: 'demo-case-' + Math.random().toString(36).slice(2, 9),
          ...d,
          status: 'abierta',
          notes: [],
          opened_at: nowIso,
          due_at: dueIso,
          updated_at: nowIso
        });
      }
      upserted++;
    }
    saveCases(cases);
    return {
      ok: true,
      activity,
      scanned: upserted,
      cases: cases.filter(c => c.activity === activity)
    };
  }

  function buildDemoAi(cases, surveys, single) {
    if (!cases.length) {
      return 'No hay alertas activas en las actividades seleccionadas (Modo Demo). El monitoreo automático sigue operativo para caída de asistencia, ausencias consecutivas, semáforo y cuestionarios.';
    }
    const escalated = cases.filter(c => c.status === 'escalada');
    const high = cases.filter(c => c.severity === 'alta');
    const rules = new Set(cases.map(c => c.rule_code));
    const lines = [];
    if (single) {
      const c = cases[0];
      lines.push(`• Diagnóstico (Demo): ${c.title} (${c.activity}${c.categoria ? ' · ' + c.categoria : ''}${c.equipo ? ' · ' + c.equipo : ''}). ${c.summary}`);
    } else {
      lines.push(`• Panorama activo (Demo): ${cases.length} alerta(s) en curso (${escalated.length} escalada(s) +48 h, ${high.length} de prioridad alta).`);
    }
    if (rules.has('CAIDA_ASISTENCIA')) {
      lines.push('• Caída de asistencia: verificá con el cuerpo docente cambios de horario, clima, competencia o superposición escolar y registrá la intervención antes de las 48 h.');
    }
    if (rules.has('AUSENCIAS_CONSECUTIVAS')) {
      lines.push('• Ausencias consecutivas: coordiná un contacto breve y cercano con las familias de quienes acumulan 3+ faltas y activá un cuestionario anónimo de motivos de inasistencia.');
    }
    if (rules.has('SEMAFORO_ALERTA')) {
      lines.push('• Semáforo en alerta: revisá el clima grupal, apoyos DUA y dinámica de clase junto al profe; un cuestionario anónimo de clima ayuda a detectar barreras tempranas.');
    }
    if (rules.has('CUESTIONARIO_ALERTA')) {
      lines.push('• Señal en cuestionario anónimo: revisá las preguntas con puntaje bajo y los comentarios anónimos del grupo para ajustar horarios, clima o acompañamientos DUA.');
    }
    const withResp = surveys.filter(s => (s.responses?.length || 0) > 0);
    if (withResp.length) {
      lines.push(`• Cuestionarios vinculados: ${withResp.length} cuestionario(s) ya cuentan con respuestas anónimas listas para cruzar con el seguimiento del grupo.`);
    } else {
      lines.push('• Cuestionarios: podés crear un cuestionario anónimo para el grupo y compartir el enlace de prueba (&demo=1) para simular respuestas al instante.');
    }
    return lines.join('\n');
  }

  function orderCases(list) {
    const rank = { escalada: 0, abierta: 1, en_revision: 2, intervenida: 3, resuelta: 4 };
    return list.slice().sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }

  async function call(path, body = {}, session = {}) {
    const nowMs = Date.now();
    const areas = Array.isArray(session?.areas) ? session.areas : [];

    if (path === '/api/dashboard') {
      const days = body.days ?? 30;
      const requested = Array.isArray(body.activities) ? body.activities : areas;
      const activities = requested.filter(a => areas.includes(a)).map(a => summarizeActivityDashboard(a, readActivityCache(a), days, nowMs));
      return { ok: true, scope: 'club', days, generatedAt: new Date(nowMs).toISOString(), activities };
    }

    if (path === '/api/surveys/list') {
      const activity = typeof body.activity === 'string' ? body.activity : '';
      const list = loadSurveys()
        .filter(s => areas.includes(s.activity) && (!activity || s.activity === activity))
        .slice()
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map(summarizeSurvey);
      return { ok: true, surveys: list };
    }

    if (path === '/api/surveys/create') {
      const activity = typeof body.activity === 'string' ? body.activity : '';
      if (!activity || !areas.includes(activity)) throw new Error('No tenés acceso a esa actividad.');
      const title = String(body.title || '').trim();
      if (!title) throw new Error('Ingresá un título para el cuestionario.');
      const questions = Array.isArray(body.questions) ? body.questions.filter(q => String(q?.label || '').trim()) : [];
      if (!questions.length || questions.length > 20) throw new Error('El cuestionario debe tener entre 1 y 20 preguntas.');
      const nowIso = new Date(nowMs).toISOString();
      const survey = {
        id: 'demo-sv-' + Math.random().toString(36).slice(2, 9),
        public_code: 'demo_' + Math.random().toString(36).slice(2, 10),
        activity,
        categoria: String(body.categoria || '').trim().slice(0, 80),
        equipo: String(body.equipo || '').trim().slice(0, 80),
        title: title.slice(0, 120),
        description: String(body.description || '').trim().slice(0, 400),
        questions: questions.map((q, idx) => ({
          id: String(q.id || ('q' + (idx + 1))),
          type: ['scale', 'single', 'multi', 'text'].includes(q.type) ? q.type : 'scale',
          label: String(q.label || '').trim().slice(0, 200),
          required: Boolean(q.required),
          ...(q.type === 'single' || q.type === 'multi' ? { options: (q.options || []).map(o => String(o || '').trim()).filter(Boolean) } : {})
        })),
        status: body.status === 'draft' ? 'draft' : 'active',
        responses: [],
        created_at: nowIso,
        updated_at: nowIso
      };
      const all = loadSurveys();
      all.unshift(survey);
      saveSurveys(all);
      return { ok: true, survey: summarizeSurvey(survey) };
    }

    if (path === '/api/surveys/status') {
      const surveyId = String(body.surveyId || '').trim();
      const status = String(body.status || '');
      if (!['draft', 'active', 'closed'].includes(status)) throw new Error('Estado inválido.');
      const all = loadSurveys();
      const target = all.find(s => s.id === surveyId && areas.includes(s.activity));
      if (!target) throw new Error('Cuestionario no encontrado.');
      target.status = status;
      target.updated_at = new Date(nowMs).toISOString();
      saveSurveys(all);
      return { ok: true, survey: summarizeSurvey(target) };
    }

    if (path === '/api/inteligencia/list') {
      const status = body.status == null ? 'activas' : String(body.status);
      const filterActs = Array.isArray(body.activities) ? body.activities : null;
      const all = loadCases().filter(c => areas.includes(c.activity));
      const counts = { abierta: 0, en_revision: 0, intervenida: 0, escalada: 0, resuelta: 0 };
      for (const c of all) if (c.status in counts) counts[c.status]++;

      const actScoped = all.filter(c => !filterActs || filterActs.includes(c.activity));
      const ruleCounts = { CAIDA_ASISTENCIA: 0, AUSENCIAS_CONSECUTIVAS: 0, SEMAFORO_ALERTA: 0, CUESTIONARIO_ALERTA: 0 };
      for (const c of actScoped) {
        if (c.status !== 'resuelta' && c.rule_code in ruleCounts) ruleCounts[c.rule_code]++;
      }
      const filtered = actScoped.filter(c => {
        if (!status) return true;
        if (status === 'activas') return c.status !== 'resuelta';
        return c.status === status;
      });
      return {
        ok: true,
        generatedAt: new Date(nowMs).toISOString(),
        aiConfigured: true,
        cases: orderCases(filtered),
        counts,
        ruleCounts
      };
    }

    if (path === '/api/inteligencia/scan') {
      const activity = typeof body.activity === 'string' ? body.activity : '';
      if (!activity || !areas.includes(activity)) throw new Error('Sólo podés analizar actividades autorizadas.');
      return scanActivityCases(activity, nowMs);
    }

    if (path === '/api/inteligencia/update') {
      const caseId = String(body.caseId || '').trim();
      const status = String(body.status || '');
      const note = String(body.note || '').trim().slice(0, 500);
      if (!['abierta', 'en_revision', 'intervenida', 'resuelta'].includes(status)) throw new Error('Estado inválido.');
      const cases = loadCases();
      const target = cases.find(c => c.id === caseId && areas.includes(c.activity));
      if (!target) throw new Error('Caso no encontrado.');
      const nowIso = new Date(nowMs).toISOString();
      target.status = status;
      target.updated_at = nowIso;
      if (status === 'resuelta') target.resolved_at = nowIso;
      target.notes = Array.isArray(target.notes) ? target.notes : [];
      target.notes.push({
        at: nowIso,
        autor: session?.profeNombre || 'Demostración',
        rol: session?.rol || 'Dirección UGI',
        action: status,
        note
      });
      saveCases(cases);
      return { ok: true, case: target };
    }

    if (path === '/api/inteligencia/ai') {
      const caseId = String(body.caseId || '').trim();
      const filterActs = Array.isArray(body.activities) ? body.activities : null;
      const allCases = loadCases().filter(c => areas.includes(c.activity));
      const allSurveys = loadSurveys().filter(s => areas.includes(s.activity));
      if (caseId) {
        const c = allCases.find(x => x.id === caseId);
        if (!c) throw new Error('Caso inexistente.');
        const relSurveys = allSurveys.filter(s => s.activity === c.activity);
        return { ok: true, source: 'ia', model: 'Demo UGI (simulación local)', analysis: buildDemoAi([c], relSurveys, true) };
      }
      const activeCases = allCases.filter(c => c.status !== 'resuelta' && (!filterActs || filterActs.includes(c.activity)));
      const relSurveys = allSurveys.filter(s => !filterActs || filterActs.includes(s.activity));
      return { ok: true, source: 'ia', model: 'Demo UGI (simulación local)', analysis: buildDemoAi(activeCases, relSurveys, false) };
    }

    throw new Error('Ruta demo no soportada: ' + path);
  }

  return { call, reset, clear, SURVEYS_KEY, CASES_KEY };
});
