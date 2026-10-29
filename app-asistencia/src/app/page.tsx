'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import {
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Utensils,
  Plus,
  Edit2,
  UserPlus,
  Trash2,
  ShieldAlert,
  ArrowLeft,
  Lock,
  Users,
  CheckCircle2,
} from 'lucide-react';

// Conexión a Supabase
const supabaseUrl = 'https://eohxmexldfjfkjdymwlm.supabase.co';
const supabaseAnonKey = 'sb_publishable_mtZs0Bn0FXsY57jHiGdFbQ_z1R03p2L';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Contraseña para el Panel Maestro de UGI
const CLAVE_ADMIN = 'ugi2026';

// Lista oficial de Deportes definida por UGI (con PIN Profe y PIN Coordinador por defecto)
const DEPORTES_OFICIALES = [
  { nombre: 'Colonia', tipo: 'colonia' as const, pinDefault: '1001', pinCoordDefault: '2001' },
  { nombre: 'Hockey sobre Patines', tipo: 'deporte' as const, pinDefault: '1002', pinCoordDefault: '2002' },
  { nombre: 'Hockey sobre Césped', tipo: 'deporte' as const, pinDefault: '1003', pinCoordDefault: '2003' },
  { nombre: 'Básquet', tipo: 'deporte' as const, pinDefault: '1004', pinCoordDefault: '2004' },
  { nombre: 'Fútbol', tipo: 'deporte' as const, pinDefault: '1005', pinCoordDefault: '2005' },
  { nombre: 'Vóley', tipo: 'deporte' as const, pinDefault: '1006', pinCoordDefault: '2006' },
  { nombre: 'Rugby', tipo: 'deporte' as const, pinDefault: '1007', pinCoordDefault: '2007' },
  { nombre: 'Natación', tipo: 'deporte' as const, pinDefault: '1008', pinCoordDefault: '2008' },
  { nombre: 'Tenis', tipo: 'deporte' as const, pinDefault: '1009', pinCoordDefault: '2009' },
  { nombre: 'Handball', tipo: 'deporte' as const, pinDefault: '1010', pinCoordDefault: '2010' },
  { nombre: 'Gimnasia', tipo: 'deporte' as const, pinDefault: '1011', pinCoordDefault: '2011' },
  { nombre: 'Patín Artístico', tipo: 'deporte' as const, pinDefault: '1012', pinCoordDefault: '2012' },
];

interface Grupo {
  id: number;
  nombre: string;
  categoria: string;
  tipo: 'deporte' | 'colonia';
}

interface Alumno {
  id: number;
  grupo_id: number;
  nombre: string;
  apellido: string;
}

interface AsistenciaState {
  estado: 'presente' | 'ausente' | 'tarde';
  almuerzo: boolean;
}

export default function AsistenciaApp() {
  // Control de Vista: Login Deporte vs Profes vs Coordinador vs Admin
  const [vista, setVista] = useState<'login_deporte' | 'profe' | 'coordinador' | 'login_admin' | 'admin'>('login_deporte');
  const [esCoordinador, setEsCoordinador] = useState(false);
  const [filtroCategoriaCoord, setFiltroCategoriaCoord] = useState<string>('TODAS');
  const [descargandoVivo, setDescargandoVivo] = useState(false);
  const [inputClave, setInputClave] = useState('');
  const [inputPinDeporte, setInputPinDeporte] = useState('');
  const [validandoPin, setValidandoPin] = useState(false);

  // Estados Vista Profe
  const [deporteSeleccionado, setDeporteSeleccionado] = useState<string>(DEPORTES_OFICIALES[0].nombre);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<number | null>(null);

  const [modoCategoria, setModoCategoria] = useState<'ninguno' | 'crear' | 'editar'>('ninguno');
  const [inputCategoria, setInputCategoria] = useState('');

  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [nuevoApellido, setNuevoApellido] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [mostrarFormAlumno, setMostrarFormAlumno] = useState(false);

  const [asistencias, setAsistencias] = useState<{ [key: number]: AsistenciaState }>({});
  const [fecha, setFecha] = useState<string>('');
  const [cargando, setCargando] = useState(false);

  // Estados Vista Admin / Coordinador (Excel Maestro, Por Deporte y Google Sheets en Vivo)
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroDeporteAdmin, setFiltroDeporteAdmin] = useState<string>('TODOS');
  const [registrosAdmin, setRegistrosAdmin] = useState<any[]>([]);
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [sheetUrlsPorDeporte, setSheetUrlsPorDeporte] = useState<Record<string, string>>({});
  const [sincronizandoSheet, setSincronizandoSheet] = useState(false);

  // Fecha de hoy (local) y sesión guardada en el celular (localStorage)
  useEffect(() => {
    const d = new Date();
    const hoy = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    setFecha(hoy);
    setFechaDesde(hoy);
    setFechaHasta(hoy);

    try {
      const urlGuardada = localStorage.getItem('ugi_google_script_url');
      if (urlGuardada) setGoogleScriptUrl(urlGuardada);
      const sheetsGuardados = localStorage.getItem('ugi_sheet_urls');
      if (sheetsGuardados) setSheetUrlsPorDeporte(JSON.parse(sheetsGuardados));

      const deporteGuardado = localStorage.getItem('ugi_deporte_logueado');
      const rolGuardado = localStorage.getItem('ugi_rol_logueado');
      if (deporteGuardado && DEPORTES_OFICIALES.some((dep) => dep.nombre === deporteGuardado)) {
        setDeporteSeleccionado(deporteGuardado);
        if (rolGuardado === 'coordinador') {
          setEsCoordinador(true);
          setVista('coordinador');
        } else {
          setEsCoordinador(false);
          setVista('profe');
        }
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }

    // Traer URLs de Google Sheets guardadas en Supabase (si existen en deportes_auth)
    supabase
      .from('deportes_auth')
      .select('deporte, sheet_url, script_url')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapa: Record<string, string> = {};
          let scriptRemoto = '';
          data.forEach((row: any) => {
            if (row.deporte && row.sheet_url) mapa[row.deporte] = row.sheet_url;
            if (row.script_url) scriptRemoto = row.script_url;
          });
          if (Object.keys(mapa).length > 0) {
            setSheetUrlsPorDeporte((prev) => ({ ...prev, ...mapa }));
          }
          if (scriptRemoto) {
            setGoogleScriptUrl(scriptRemoto);
          }
        }
      });
  }, []);

  // Cargar grupos
  const cargarGrupos = async (deporteActual: string, idSeleccionar?: number) => {
    const { data } = await supabase.from('grupos').select('*').order('categoria');
    if (data) {
      setGrupos(data);
      const filtrados = data.filter((g) => g.nombre === deporteActual);
      if (idSeleccionar) {
        setGrupoSeleccionado(idSeleccionar);
      } else if (filtrados.length > 0) {
        setGrupoSeleccionado(filtrados[0].id);
      } else {
        setGrupoSeleccionado(null);
      }
    }
  };

  useEffect(() => {
    cargarGrupos(deporteSeleccionado);
  }, [deporteSeleccionado]);

  // Cargar alumnos y asistencias compartidas
  const cargarAlumnosYAsistencias = async () => {
    if (!fecha) return;
    if (!grupoSeleccionado) {
      setAlumnos([]);
      setAsistencias({});
      return;
    }

    const { data: alumnosData } = await supabase
      .from('alumnos')
      .select('*')
      .eq('grupo_id', grupoSeleccionado)
      .eq('activo', true)
      .order('apellido');

    if (alumnosData) {
      setAlumnos(alumnosData);
      const ids = alumnosData.map((a) => a.id);

      const mapaAsistencias: { [key: number]: AsistenciaState } = {};
      if (ids.length > 0) {
        const { data: asistData } = await supabase
          .from('asistencias')
          .select('*')
          .eq('fecha', fecha)
          .in('alumno_id', ids);

        alumnosData.forEach((al) => {
          const existente = asistData?.find((a) => a.alumno_id === al.id);
          if (existente) {
            mapaAsistencias[al.id] = {
              estado: existente.estado,
              almuerzo: existente.almuerzo,
            };
          } else {
            mapaAsistencias[al.id] = { estado: 'presente', almuerzo: false };
          }
        });
      }
      setAsistencias(mapaAsistencias);
    }
  };

  useEffect(() => {
    cargarAlumnosYAsistencias();
  }, [grupoSeleccionado, fecha]);

  // Cargar datos cuando se abre el Panel Admin
  const cargarReporteMaestro = async () => {
    if (!fechaDesde || !fechaHasta) return;
    setCargandoAdmin(true);
    const { data, error } = await supabase
      .from('asistencias')
      .select(`
        id,
        fecha,
        estado,
        almuerzo,
        alumnos (
          id,
          nombre,
          apellido,
          grupos (
            id,
            nombre,
            categoria,
            tipo
          )
        )
      `)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false });

    if (!error && data) {
      setRegistrosAdmin(data);
    }
    setCargandoAdmin(false);
  };

  useEffect(() => {
    if (vista === 'admin' || vista === 'coordinador') {
      cargarReporteMaestro();
    }
  }, [vista, fechaDesde, fechaHasta]);

  // Verificar contraseña Admin
  const ingresarAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputClave === CLAVE_ADMIN) {
      setInputClave('');
      setVista('admin');
    } else {
      alert('Contraseña incorrecta');
    }
  };

  // Verificar PIN de Deporte (Profe o Coordinador) contra `deportes_auth` en Supabase
  const ingresarDeporte = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinIngresado = inputPinDeporte.trim();
    if (!pinIngresado) return;

    setValidandoPin(true);
    const infoDeporte = DEPORTES_OFICIALES.find((d) => d.nombre === deporteSeleccionado);

    const { data, error } = await supabase
      .from('deportes_auth')
      .select('*')
      .eq('deporte', deporteSeleccionado)
      .maybeSingle();

    setValidandoPin(false);

    const pinProfeEsperado = !error && data?.pin ? String(data.pin).trim() : infoDeporte?.pinDefault;
    const pinCoordEsperado =
      !error && data?.pin_coord ? String(data.pin_coord).trim() : infoDeporte?.pinCoordDefault;

    if (pinIngresado === pinCoordEsperado || pinIngresado === CLAVE_ADMIN) {
      try {
        localStorage.setItem('ugi_deporte_logueado', deporteSeleccionado);
        localStorage.setItem('ugi_rol_logueado', 'coordinador');
      } catch {
        // Ignorar si localStorage no está disponible
      }
      setEsCoordinador(true);
      setFiltroCategoriaCoord('TODAS');
      setInputPinDeporte('');
      setModoCategoria('ninguno');
      setVista('coordinador');
    } else if (pinIngresado === pinProfeEsperado) {
      try {
        localStorage.setItem('ugi_deporte_logueado', deporteSeleccionado);
        localStorage.setItem('ugi_rol_logueado', 'profe');
      } catch {
        // Ignorar si localStorage no está disponible
      }
      setEsCoordinador(false);
      setInputPinDeporte('');
      setModoCategoria('ninguno');
      setVista('profe');
    } else {
      alert('PIN incorrecto para ' + deporteSeleccionado);
    }
  };

  const cerrarSesionDeporte = () => {
    try {
      localStorage.removeItem('ugi_deporte_logueado');
      localStorage.removeItem('ugi_rol_logueado');
    } catch {
      // Ignorar si localStorage no está disponible
    }
    setEsCoordinador(false);
    setInputPinDeporte('');
    setModoCategoria('ninguno');
    setVista('login_deporte');
  };

  // Crear o Editar Categoría
  const guardarCategoria = async () => {
    if (!inputCategoria.trim()) return;
    const infoDeporte = DEPORTES_OFICIALES.find((d) => d.nombre === deporteSeleccionado)!;

    if (modoCategoria === 'crear') {
      const { data, error } = await supabase
        .from('grupos')
        .insert([
          {
            nombre: deporteSeleccionado,
            categoria: inputCategoria.trim(),
            tipo: infoDeporte.tipo,
          },
        ])
        .select()
        .single();

      if (error) {
        alert('Error al crear categoría: ' + error.message);
      } else if (data) {
        setModoCategoria('ninguno');
        setInputCategoria('');
        await cargarGrupos(deporteSeleccionado, data.id);
      }
    } else if (modoCategoria === 'editar' && grupoSeleccionado) {
      const { error } = await supabase
        .from('grupos')
        .update({ categoria: inputCategoria.trim() })
        .eq('id', grupoSeleccionado);

      if (error) {
        alert('Error al editar categoría: ' + error.message);
      } else {
        setModoCategoria('ninguno');
        setInputCategoria('');
        await cargarGrupos(deporteSeleccionado, grupoSeleccionado);
      }
    }
  };

  // Agregar Alumno
  const agregarAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoSeleccionado || !nuevoNombre.trim() || !nuevoApellido.trim()) return;

    const { error } = await supabase.from('alumnos').insert([
      {
        grupo_id: grupoSeleccionado,
        nombre: nuevoNombre.trim(),
        apellido: nuevoApellido.trim(),
        activo: true,
      },
    ]);

    if (error) {
      alert('Error al agregar alumno: ' + error.message);
    } else {
      setNuevoNombre('');
      setNuevoApellido('');
      await cargarAlumnosYAsistencias();
    }
  };

  // Dar de baja alumno
  const eliminarAlumno = async (id: number, nombreCompleto: string) => {
    if (!confirm(`¿Quitar a ${nombreCompleto} de esta categoría?`)) return;
    await supabase.from('alumnos').update({ activo: false }).eq('id', id);
    await cargarAlumnosYAsistencias();
  };

  const handleEstado = (id: number, nuevoEstado: 'presente' | 'ausente' | 'tarde') => {
    setAsistencias((prev) => ({
      ...prev,
      [id]: {
        estado: nuevoEstado,
        almuerzo: nuevoEstado === 'ausente' ? false : prev[id]?.almuerzo || false,
      },
    }));
  };

  const handleAlmuerzo = (id: number) => {
    setAsistencias((prev) => ({
      ...prev,
      [id]: { ...prev[id], almuerzo: !prev[id]?.almuerzo },
    }));
  };

  // Guardar Asistencia (y actualizar automáticamente el Google Sheet del Deporte en vivo)
  const guardarAsistencias = async () => {
    if (alumnos.length === 0) return;
    setCargando(true);
    const registros = alumnos.map((al) => ({
      fecha,
      alumno_id: al.id,
      estado: asistencias[al.id]?.estado || 'presente',
      almuerzo: asistencias[al.id]?.almuerzo || false,
    }));

    const { error } = await supabase
      .from('asistencias')
      .upsert(registros, { onConflict: 'fecha,alumno_id' });
    setCargando(false);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      // Disparamos en segundo plano la actualización del Google Sheet de este deporte
      sincronizarGoogleSheetDeporte(deporteSeleccionado, false);
      alert('¡Asistencia guardada correctamente!');
    }
  };

  // Exportar Excel Individual del Profe
  const exportarExcelProfe = () => {
    const grupoActual = grupos.find((g) => g.id === Number(grupoSeleccionado));
    if (!grupoActual || alumnos.length === 0) return;

    const dataParaExcel = alumnos.map((al) => {
      const registro = asistencias[al.id] || { estado: 'presente', almuerzo: false };
      return {
        Fecha: fecha,
        Deporte: grupoActual.nombre,
        Categoría: grupoActual.categoria,
        Alumno: `${al.apellido}, ${al.nombre}`,
        Estado: registro.estado.toUpperCase(),
        Almuerzo: grupoActual.tipo === 'colonia' ? (registro.almuerzo ? 'SÍ' : 'NO') : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencia');
    XLSX.writeFile(
      workbook,
      `Asistencia_${grupoActual.nombre}_${grupoActual.categoria}_${fecha}.xlsx`
    );
  };

  // Exportar Excel Maestro desde Admin
  const descargarExcelMaestro = () => {
    const filtrados = registrosAdmin.filter((r: any) =>
      filtroDeporteAdmin === 'TODOS' ? true : r.alumnos?.grupos?.nombre === filtroDeporteAdmin
    );

    if (filtrados.length === 0) {
      alert('No hay asistencias registradas con estos filtros.');
      return;
    }

    const filasDetalle = filtrados.map((r: any) => {
      const alumno = r.alumnos;
      const grupo = alumno?.grupos;
      return {
        Fecha: r.fecha,
        Tipo: grupo?.tipo?.toUpperCase() || '',
        Deporte_Actividad: grupo?.nombre || '',
        Categoría: grupo?.categoria || '',
        Alumno: alumno ? `${alumno.apellido}, ${alumno.nombre}` : '',
        Estado: r.estado.toUpperCase(),
        Almuerzo: grupo?.tipo === 'colonia' ? (r.almuerzo ? 'SÍ' : 'NO') : 'N/A',
      };
    });

    const workbook = XLSX.utils.book_new();
    const hojaGeneral = XLSX.utils.json_to_sheet(filasDetalle);
    XLSX.utils.book_append_sheet(workbook, hojaGeneral, 'Reporte Maestro UGI');
    XLSX.writeFile(workbook, `Reporte_Maestro_UGI_${fechaDesde}_a_${fechaHasta}.xlsx`);
  };

  // Exportar Excel Actualizado Acumulativo por Deporte o Colonia (Todos los Grupos + Matriz Viva Alumno x Fecha)
  const descargarExcelActualizadoDeporte = async (nombreDeporte: string) => {
    setDescargandoVivo(true);

    const { data: gruposDeporte } = await supabase
      .from('grupos')
      .select('*')
      .eq('nombre', nombreDeporte)
      .order('categoria');

    if (!gruposDeporte || gruposDeporte.length === 0) {
      setDescargandoVivo(false);
      alert(`Aún no hay categorías/grupos creados en ${nombreDeporte}.`);
      return;
    }

    const idsGrupos = gruposDeporte.map((g) => g.id);
    const esColoniaDeporte =
      DEPORTES_OFICIALES.find((d) => d.nombre === nombreDeporte)?.tipo === 'colonia';

    const { data: alumnosDeporte } = await supabase
      .from('alumnos')
      .select('*')
      .in('grupo_id', idsGrupos)
      .eq('activo', true)
      .order('apellido');

    const idsAlumnos = (alumnosDeporte || []).map((a) => a.id);

    let asistenciasHist: any[] = [];
    if (idsAlumnos.length > 0) {
      const { data: asistData } = await supabase
        .from('asistencias')
        .select('*')
        .in('alumno_id', idsAlumnos)
        .order('fecha', { ascending: true });
      asistenciasHist = asistData || [];
    }

    const fechasUnicas = Array.from(new Set(asistenciasHist.map((a) => a.fecha))).sort();
    const mapaGrupoPorId = new Map(gruposDeporte.map((g) => [g.id, g]));

    // 1. Hoja Matriz de Seguimiento (Alumno x Fecha que se actualiza automáticamente)
    const construirMatrizAlumnos = (listaAlumnos: any[]) =>
      listaAlumnos.map((al) => {
        const gr = mapaGrupoPorId.get(al.grupo_id);
        const regsAlumno = asistenciasHist.filter((a) => a.alumno_id === al.id);
        const presentes = regsAlumno.filter((a) => a.estado === 'presente').length;
        const tardes = regsAlumno.filter((a) => a.estado === 'tarde').length;
        const ausentes = regsAlumno.filter((a) => a.estado === 'ausente').length;
        const almuerzos = regsAlumno.filter((a) => a.almuerzo).length;
        const totalDias = regsAlumno.length;
        const pctAsistencia =
          totalDias > 0 ? `${Math.round(((presentes + tardes) / totalDias) * 100)}%` : '-';

        const fila: Record<string, any> = {
          Deporte_Actividad: nombreDeporte,
          Categoría_Grupo: gr?.categoria || '',
          Alumno: `${al.apellido}, ${al.nombre}`,
          Asistencia_Pct: pctAsistencia,
          Presentes: presentes,
          Tardes: tardes,
          Ausentes: ausentes,
        };

        if (esColoniaDeporte) {
          fila.Total_Almuerzos = almuerzos;
        }

        fechasUnicas.forEach((f) => {
          const reg = regsAlumno.find((r) => r.fecha === f);
          if (!reg) {
            fila[f] = '-';
          } else {
            const letra =
              reg.estado === 'presente' ? 'P' : reg.estado === 'tarde' ? 'T' : 'A';
            fila[f] =
              esColoniaDeporte && reg.almuerzo ? `${letra} (Almuerza)` : letra;
          }
        });

        return fila;
      });

    // 2. Hoja Resumen por Grupo / Categoría
    const filasResumenGrupos = gruposDeporte.map((gr) => {
      const alsGrupo = (alumnosDeporte || []).filter((a) => a.grupo_id === gr.id);
      const idsAlsGrupo = new Set(alsGrupo.map((a) => a.id));
      const regsGrupo = asistenciasHist.filter((r) => idsAlsGrupo.has(r.alumno_id));
      const pres = regsGrupo.filter((r) => r.estado === 'presente').length;
      const tard = regsGrupo.filter((r) => r.estado === 'tarde').length;
      const aus = regsGrupo.filter((r) => r.estado === 'ausente').length;
      const alm = regsGrupo.filter((r) => r.almuerzo).length;

      return {
        Deporte_Actividad: nombreDeporte,
        Categoría_Grupo: gr.categoria,
        Alumnos_Activos: alsGrupo.length,
        Registros_Cargados: regsGrupo.length,
        Presentes: pres,
        Tardes: tard,
        Ausentes: aus,
        Almuerzos_Acumulados: esColoniaDeporte ? alm : 'N/A',
      };
    });

    // 3. Hoja Detalle Diario Completo de Todos los Grupos
    const mapaAlumnoPorId = new Map((alumnosDeporte || []).map((a) => [a.id, a]));
    const filasDetalleDiario = [...asistenciasHist]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((r) => {
        const al = mapaAlumnoPorId.get(r.alumno_id);
        const gr = al ? mapaGrupoPorId.get(al.grupo_id) : undefined;
        return {
          Fecha: r.fecha,
          Deporte_Actividad: nombreDeporte,
          Categoría_Grupo: gr?.categoria || '',
          Alumno: al ? `${al.apellido}, ${al.nombre}` : '',
          Estado: String(r.estado).toUpperCase(),
          Almuerzo: esColoniaDeporte ? (r.almuerzo ? 'SÍ' : 'NO') : 'N/A',
        };
      });

    const workbook = XLSX.utils.book_new();

    const matrizGeneral = construirMatrizAlumnos(alumnosDeporte || []);
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        matrizGeneral.length > 0
          ? matrizGeneral
          : [{ Info: 'Sin alumnos cargados aún en ' + nombreDeporte }]
      ),
      'Seguimiento Vivo'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(filasResumenGrupos),
      'Resumen Grupos'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        filasDetalleDiario.length > 0
          ? filasDetalleDiario
          : [{ Info: 'Sin asistencias registradas aún' }]
      ),
      'Detalle Diario'
    );

    // 4. Una pestaña individual por cada Categoría / Grupo del Deporte o Colonia
    gruposDeporte.forEach((gr, idx) => {
      const alsGrupo = (alumnosDeporte || []).filter((a) => a.grupo_id === gr.id);
      const matrizGrupo = construirMatrizAlumnos(alsGrupo);
      const nombreLimpio = gr.categoria
        .replace(/[\\/?*[\]:]/g, ' ')
        .trim()
        .slice(0, 25);
      const nombreHoja = nombreLimpio || `Grupo_${idx + 1}`;
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          matrizGrupo.length > 0
            ? matrizGrupo
            : [{ Categoría: gr.categoria, Info: 'Sin alumnos cargados' }]
        ),
        nombreHoja
      );
    });

    setDescargandoVivo(false);
    XLSX.writeFile(
      workbook,
      `Excel_Actualizado_${nombreDeporte.replace(/\s+/g, '_')}_al_${fecha || 'hoy'}.xlsx`
    );
  };

  // Sincronizar en vivo el Google Sheet exclusivo de un Deporte / Colonia
  const sincronizarGoogleSheetDeporte = async (nombreDeporte: string, mostrarAlerta = true) => {
    const urlDestino = googleScriptUrl.trim();
    if (!urlDestino) {
      if (mostrarAlerta) {
        alert(
          'Primero pegá la URL /exec de tu Google Apps Script en el Panel Maestro UGI para activar Google Sheets en vivo.'
        );
      }
      return;
    }

    setSincronizandoSheet(true);
    try {
      const { data: gruposDeporte } = await supabase
        .from('grupos')
        .select('*')
        .eq('nombre', nombreDeporte)
        .order('categoria');

      const idsGrupos = (gruposDeporte || []).map((g) => g.id);
      const esColoniaDeporte =
        DEPORTES_OFICIALES.find((d) => d.nombre === nombreDeporte)?.tipo === 'colonia';

      let alumnosDeporte: any[] = [];
      if (idsGrupos.length > 0) {
        const { data: als } = await supabase
          .from('alumnos')
          .select('*')
          .in('grupo_id', idsGrupos)
          .eq('activo', true)
          .order('apellido');
        alumnosDeporte = als || [];
      }

      const idsAlumnos = alumnosDeporte.map((a) => a.id);
      let asistenciasHist: any[] = [];
      if (idsAlumnos.length > 0) {
        const { data: asistData } = await supabase
          .from('asistencias')
          .select('*')
          .in('alumno_id', idsAlumnos)
          .order('fecha', { ascending: true });
        asistenciasHist = asistData || [];
      }

      const fechasUnicas = Array.from(new Set(asistenciasHist.map((a) => a.fecha))).sort();
      const mapaGrupoPorId = new Map((gruposDeporte || []).map((g) => [g.id, g]));

      const construirMatrizAlumnos = (listaAlumnos: any[]) =>
        listaAlumnos.map((al) => {
          const gr = mapaGrupoPorId.get(al.grupo_id);
          const regsAlumno = asistenciasHist.filter((a) => a.alumno_id === al.id);
          const presentes = regsAlumno.filter((a) => a.estado === 'presente').length;
          const tardes = regsAlumno.filter((a) => a.estado === 'tarde').length;
          const ausentes = regsAlumno.filter((a) => a.estado === 'ausente').length;
          const almuerzos = regsAlumno.filter((a) => a.almuerzo).length;
          const totalDias = regsAlumno.length;
          const pctAsistencia =
            totalDias > 0 ? `${Math.round(((presentes + tardes) / totalDias) * 100)}%` : '-';

          const fila: Record<string, any> = {
            Deporte_Actividad: nombreDeporte,
            Categoría_Grupo: gr?.categoria || '',
            Alumno: `${al.apellido}, ${al.nombre}`,
            Asistencia_Pct: pctAsistencia,
            Presentes: presentes,
            Tardes: tardes,
            Ausentes: ausentes,
          };

          if (esColoniaDeporte) {
            fila.Total_Almuerzos = almuerzos;
          }

          fechasUnicas.forEach((f) => {
            const reg = regsAlumno.find((r) => r.fecha === f);
            if (!reg) {
              fila[f] = '-';
            } else {
              const letra =
                reg.estado === 'presente' ? 'P' : reg.estado === 'tarde' ? 'T' : 'A';
              fila[f] =
                esColoniaDeporte && reg.almuerzo ? `${letra} (Almuerza)` : letra;
            }
          });

          return fila;
        });

      const resumenGrupos = (gruposDeporte || []).map((gr) => {
        const alsGrupo = alumnosDeporte.filter((a) => a.grupo_id === gr.id);
        const idsAlsGrupo = new Set(alsGrupo.map((a) => a.id));
        const regsGrupo = asistenciasHist.filter((r) => idsAlsGrupo.has(r.alumno_id));
        return {
          Deporte_Actividad: nombreDeporte,
          Categoría_Grupo: gr.categoria,
          Alumnos_Activos: alsGrupo.length,
          Presentes: regsGrupo.filter((r) => r.estado === 'presente').length,
          Tardes: regsGrupo.filter((r) => r.estado === 'tarde').length,
          Ausentes: regsGrupo.filter((r) => r.estado === 'ausente').length,
          Almuerzos_Acumulados: esColoniaDeporte
            ? regsGrupo.filter((r) => r.almuerzo).length
            : 'N/A',
        };
      });

      const mapaAlumnoPorId = new Map(alumnosDeporte.map((a) => [a.id, a]));
      const detalleDiario = [...asistenciasHist]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map((r) => {
          const al = mapaAlumnoPorId.get(r.alumno_id);
          const gr = al ? mapaGrupoPorId.get(al.grupo_id) : undefined;
          return {
            Fecha: r.fecha,
            Deporte_Actividad: nombreDeporte,
            Categoría_Grupo: gr?.categoria || '',
            Alumno: al ? `${al.apellido}, ${al.nombre}` : '',
            Estado: String(r.estado).toUpperCase(),
            Almuerzo: esColoniaDeporte ? (r.almuerzo ? 'SÍ' : 'NO') : 'N/A',
          };
        });

      const hojasPorGrupo = (gruposDeporte || []).map((gr, idx) => {
        const alsGrupo = alumnosDeporte.filter((a) => a.grupo_id === gr.id);
        const nombreLimpio = gr.categoria
          .replace(/[\\/?*[\]:]/g, ' ')
          .trim()
          .slice(0, 25);
        return {
          nombreHoja: nombreLimpio || `Grupo_${idx + 1}`,
          filas: construirMatrizAlumnos(alsGrupo),
        };
      });

      const resp = await fetch(urlDestino, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          deporte: nombreDeporte,
          matrizGeneral: construirMatrizAlumnos(alumnosDeporte),
          resumenGrupos,
          detalleDiario,
          hojasPorGrupo,
        }),
      });

      const resJson = await resp.json();
      if (resJson && resJson.sheetUrl) {
        setSheetUrlsPorDeporte((prev) => {
          const nuevo = { ...prev, [nombreDeporte]: resJson.sheetUrl };
          try {
            localStorage.setItem('ugi_sheet_urls', JSON.stringify(nuevo));
          } catch {}
          return nuevo;
        });

        await supabase
          .from('deportes_auth')
          .update({ sheet_url: resJson.sheetUrl, script_url: urlDestino })
          .eq('deporte', nombreDeporte);

        if (mostrarAlerta) {
          alert(`¡Google Sheet de ${nombreDeporte} actualizado en vivo!`);
        }
      }
    } catch {
      if (mostrarAlerta) {
        alert('Se envió la actualización al Google Sheet de ' + nombreDeporte);
      }
    } finally {
      setSincronizandoSheet(false);
    }
  };

  // ==========================================
  // VISTA 0: ACCESO POR PIN DE DEPORTE (PROFES)
  // ==========================================
  if (vista === 'login_deporte') {
    return (
      <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-6 w-full max-w-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <div className="w-6" />
            <div className="text-blue-600">
              <Lock size={30} />
            </div>
            <button
              type="button"
              onClick={() => setVista('login_admin')}
              className="text-slate-400 hover:text-blue-600 transition-colors p-1"
              title="Acceso Director UGI"
            >
              <ShieldAlert size={18} />
            </button>
          </div>

          <h1 className="text-lg font-bold text-slate-800 text-center mb-1">
            Acceso por Deporte - UGI
          </h1>
          <p className="text-xs text-slate-500 text-center mb-4">
            Elegí tu deporte o colonia e ingresá tu <b>PIN de Profe</b> o tu <b>PIN de Coordinador</b>.
          </p>

          <form onSubmit={ingresarDeporte} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Deporte / Actividad:
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 font-medium"
                value={deporteSeleccionado}
                onChange={(e) => {
                  setDeporteSeleccionado(e.target.value);
                  setInputPinDeporte('');
                }}
              >
                {DEPORTES_OFICIALES.map((dep) => (
                  <option key={dep.nombre} value={dep.nombre}>
                    {dep.nombre} ({dep.tipo.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                PIN del Deporte:
              </label>
              <input
                type="password"
                placeholder="Ingresá tu PIN..."
                value={inputPinDeporte}
                onChange={(e) => setInputPinDeporte(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 text-center tracking-widest"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={validandoPin}
              className="w-full bg-blue-600 disabled:bg-slate-300 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              {validandoPin ? 'Verificando PIN...' : `Ingresar a ${deporteSeleccionado}`}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setVista('login_admin')}
              className="text-xs text-slate-500 hover:text-blue-600 font-medium inline-flex items-center gap-1"
            >
              <ShieldAlert size={13} /> Acceso Director UGI (Tablero Maestro)
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA 1: PANTALLA DE CONTRASEÑA ADMIN
  // ==========================================
  if (vista === 'login_admin') {
    return (
      <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-6 w-full max-w-sm border border-slate-200">
          <div className="flex justify-center mb-3 text-blue-600">
            <Lock size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 text-center mb-1">
            Acceso Director UGI
          </h2>
          <p className="text-xs text-slate-500 text-center mb-4">
            Ingresá la clave para ver el Tablero General y descargar el Excel Maestro.
          </p>
          <form onSubmit={ingresarAdmin} className="space-y-3">
            <input
              type="password"
              placeholder="Contraseña..."
              value={inputClave}
              onChange={(e) => setInputClave(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 text-center"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVista('login_deporte')}
                className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700"
              >
                Ingresar
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA 2: PANEL ADMINISTRADOR (EXCEL MAESTRO)
  // ==========================================
  if (vista === 'admin') {
    const registrosFiltrados = registrosAdmin.filter((r: any) =>
      filtroDeporteAdmin === 'TODOS' ? true : r.alumnos?.grupos?.nombre === filtroDeporteAdmin
    );
    const totalPresentes = registrosFiltrados.filter(
      (r) => r.estado === 'presente' || r.estado === 'tarde'
    ).length;
    const totalAlmuerzosAdmin = registrosFiltrados.filter((r) => r.almuerzo).length;

    return (
      <main className="min-h-screen bg-slate-100 p-4 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setVista('login_deporte')}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Volver al Acceso de Deportes
            </button>
            <span className="text-xs bg-slate-800 text-white px-2.5 py-1 rounded font-bold">
              PANEL MAESTRO UGI
            </span>
          </div>

          <h1 className="text-xl font-bold text-slate-800 mb-1">
            Tablero General y Excel Maestro
          </h1>
          <p className="text-xs text-slate-500 mb-5">
            Unidad de Gestión Integral • Club Ciudad de Buenos Aires
          </p>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-slate-50 p-3 rounded-lg border border-slate-200 mb-5">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Deporte:</label>
              <select
                value={filtroDeporteAdmin}
                onChange={(e) => setFiltroDeporteAdmin(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              >
                <option value="TODOS">Todos los deportes</option>
                {DEPORTES_OFICIALES.map((d) => (
                  <option key={d.nombre} value={d.nombre}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={descargarExcelMaestro}
              className="bg-emerald-600 text-white py-2 px-3 rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 flex items-center justify-center gap-1.5 h-[34px]"
            >
              <Download size={15} /> Excel Maestro
            </button>
          </div>

          {/* Configuración de Google Sheets en Vivo (1 Sheet privado por Deporte) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-5">
            <div className="text-xs font-bold text-emerald-900 mb-1">
              Google Sheets en Vivo (1 Planilla Independiente por Deporte - Solo Lectura para Coordinadores)
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="Pegá acá la URL /exec de tu Google Apps Script..."
                value={googleScriptUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setGoogleScriptUrl(val);
                  try {
                    localStorage.setItem('ugi_google_script_url', val);
                  } catch {}
                }}
                className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              />
              {filtroDeporteAdmin !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => sincronizarGoogleSheetDeporte(filtroDeporteAdmin, true)}
                  disabled={sincronizandoSheet}
                  className="bg-emerald-700 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-800"
                >
                  {sincronizandoSheet
                    ? 'Sincronizando...'
                    : `Crear/Actualizar Sheet de ${filtroDeporteAdmin}`}
                </button>
              )}
            </div>
            {Object.keys(sheetUrlsPorDeporte).length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200 flex flex-wrap gap-2">
                {Object.entries(sheetUrlsPorDeporte).map(([dep, url]) => (
                  <a
                    key={dep}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded font-semibold hover:bg-emerald-100"
                  >
                    📊 Abrir Sheet: {dep}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
                <Users size={14} /> Registros
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {registrosFiltrados.length}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={14} /> Presentes / Tardes
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{totalPresentes}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <Utensils size={14} /> Almuerzos
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-1">
                {totalAlmuerzosAdmin}
              </div>
            </div>
          </div>

          {/* Tabla General */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Deporte / Colonia</th>
                  <th className="p-2.5">Categoría</th>
                  <th className="p-2.5">Alumno</th>
                  <th className="p-2.5">Estado</th>
                  <th className="p-2.5">Almuerzo</th>
                </tr>
              </thead>
              <tbody>
                {cargandoAdmin ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Cargando asistencias...
                    </td>
                  </tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No hay asistencias guardadas para este filtro.
                    </td>
                  </tr>
                ) : (
                  registrosFiltrados.map((r: any) => {
                    const al = r.alumnos;
                    const gr = al?.grupos;
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-700">{r.fecha}</td>
                        <td className="p-2.5 text-slate-700">{gr?.nombre}</td>
                        <td className="p-2.5 text-slate-600">{gr?.categoria}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {al?.apellido}, {al?.nombre}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.estado === 'presente'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.estado === 'tarde'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.estado}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {gr?.tipo === 'colonia' ? (r.almuerzo ? '🍴 Sí' : 'No') : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA 2B: PANEL COORDINADOR POR DEPORTE / COLONIA
  // ==========================================
  if (vista === 'coordinador') {
    const categoriasCoord = grupos.filter((g) => g.nombre === deporteSeleccionado);
    const esColoniaCoord =
      DEPORTES_OFICIALES.find((d) => d.nombre === deporteSeleccionado)?.tipo === 'colonia';

    const registrosDeporte = registrosAdmin.filter(
      (r: any) => r.alumnos?.grupos?.nombre === deporteSeleccionado
    );
    const registrosFiltradosCoord = registrosDeporte.filter((r: any) =>
      filtroCategoriaCoord === 'TODAS'
        ? true
        : r.alumnos?.grupos?.categoria === filtroCategoriaCoord
    );

    const presentesCoord = registrosFiltradosCoord.filter(
      (r) => r.estado === 'presente' || r.estado === 'tarde'
    ).length;
    const ausentesCoord = registrosFiltradosCoord.filter(
      (r) => r.estado === 'ausente'
    ).length;
    const almuerzosCoord = registrosFiltradosCoord.filter((r) => r.almuerzo).length;

    const descargarExcelRangoCoordinador = () => {
      if (registrosFiltradosCoord.length === 0) {
        alert('No hay asistencias cargadas en este rango de fechas.');
        return;
      }
      const filas = registrosFiltradosCoord.map((r: any) => {
        const al = r.alumnos;
        const gr = al?.grupos;
        return {
          Fecha: r.fecha,
          Deporte_Actividad: gr?.nombre || deporteSeleccionado,
          Categoría_Grupo: gr?.categoria || '',
          Alumno: al ? `${al.apellido}, ${al.nombre}` : '',
          Estado: String(r.estado).toUpperCase(),
          Almuerzo: esColoniaCoord ? (r.almuerzo ? 'SÍ' : 'NO') : 'N/A',
        };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Todos los Grupos');
      XLSX.writeFile(
        wb,
        `Asistencias_${deporteSeleccionado.replace(/\s+/g, '_')}_${fechaDesde}_a_${fechaHasta}.xlsx`
      );
    };

    return (
      <main className="min-h-screen bg-slate-100 p-4 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <button
              onClick={cerrarSesionDeporte}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Cambiar deporte / Cerrar sesión
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVista('profe')}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded font-semibold hover:bg-blue-100"
              >
                Ir a Tomar Asistencia (Modo Profe)
              </button>
              <span className="text-xs bg-indigo-700 text-white px-2.5 py-1 rounded font-bold uppercase">
                COORDINACIÓN • {deporteSeleccionado}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                Panel Coordinador: {deporteSeleccionado}
              </h1>
              <p className="text-xs text-slate-500">
                Todos los equipos/grupos de {deporteSeleccionado} unificados • UGI CCBA
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {sheetUrlsPorDeporte[deporteSeleccionado] && (
                <a
                  href={sheetUrlsPorDeporte[deporteSeleccionado]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-700 text-white py-2.5 px-3.5 rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-800 flex items-center justify-center gap-1.5"
                >
                  📊 Abrir Google Sheet en Vivo
                </a>
              )}
              {googleScriptUrl && (
                <button
                  type="button"
                  onClick={() => sincronizarGoogleSheetDeporte(deporteSeleccionado, true)}
                  disabled={sincronizandoSheet}
                  className="bg-indigo-600 disabled:bg-slate-300 text-white py-2.5 px-3 rounded-lg text-xs font-bold shadow-xs hover:bg-indigo-700"
                >
                  {sincronizandoSheet ? 'Sincronizando...' : 'Actualizar Google Sheet'}
                </button>
              )}
              <button
                type="button"
                onClick={() => descargarExcelActualizadoDeporte(deporteSeleccionado)}
                disabled={descargandoVivo}
                className="bg-emerald-600 disabled:bg-slate-300 text-white py-2.5 px-4 rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 flex items-center justify-center gap-1.5"
              >
                <Download size={15} />
                {descargandoVivo
                  ? 'Generando Planilla...'
                  : `Descargar Excel (${deporteSeleccionado})`}
              </button>
            </div>
          </div>

          {/* Filtros del Coordinador */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-slate-50 p-3 rounded-lg border border-slate-200 mb-5">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Categoría / Grupo:
              </label>
              <select
                value={filtroCategoriaCoord}
                onChange={(e) => setFiltroCategoriaCoord(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              >
                <option value="TODAS">Todas las categorías ({categoriasCoord.length})</option>
                {categoriasCoord.map((c) => (
                  <option key={c.id} value={c.categoria}>
                    {c.categoria}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={descargarExcelRangoCoordinador}
              className="bg-blue-600 text-white py-2 px-3 rounded-lg text-xs font-bold shadow-xs hover:bg-blue-700 flex items-center justify-center gap-1.5 h-[34px]"
            >
              <Download size={14} /> Descargar Filtro
            </button>
          </div>

          {/* Tarjetas Resumen del Deporte */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
                <Users size={14} /> Registros
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-1">
                {registrosFiltradosCoord.length}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={14} /> Presentes / Tardes
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{presentesCoord}</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="text-xs text-rose-700 font-medium flex items-center gap-1">
                <XCircle size={14} /> Ausentes
              </div>
              <div className="text-2xl font-bold text-rose-900 mt-1">{ausentesCoord}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <Utensils size={14} /> {esColoniaCoord ? 'Almuerzos' : 'Grupos Activos'}
              </div>
              <div className="text-2xl font-bold text-amber-900 mt-1">
                {esColoniaCoord ? almuerzosCoord : categoriasCoord.length}
              </div>
            </div>
          </div>

          {/* Resumen rápido por cada Categoría / Grupo */}
          {categoriasCoord.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-600 uppercase mb-2">
                Resumen por Categoría / Grupo ({deporteSeleccionado})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoriasCoord.map((cat) => {
                  const regsCat = registrosDeporte.filter(
                    (r: any) => r.alumnos?.grupos?.categoria === cat.categoria
                  );
                  const presCat = regsCat.filter(
                    (r: any) => r.estado === 'presente' || r.estado === 'tarde'
                  ).length;
                  const almCat = regsCat.filter((r: any) => r.almuerzo).length;
                  return (
                    <div
                      key={cat.id}
                      onClick={() =>
                        setFiltroCategoriaCoord(
                          filtroCategoriaCoord === cat.categoria ? 'TODAS' : cat.categoria
                        )
                      }
                      className={`cursor-pointer p-2.5 rounded-lg border text-xs transition-colors ${
                        filtroCategoriaCoord === cat.categoria
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold truncate">{cat.categoria}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Presentes: <b>{presCat}</b> / {regsCat.length}
                        {esColoniaCoord ? ` • 🍴 ${almCat}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabla de Todos los Grupos del Deporte */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Categoría / Grupo</th>
                  <th className="p-2.5">Alumno</th>
                  <th className="p-2.5">Estado</th>
                  {esColoniaCoord && <th className="p-2.5">Almuerzo</th>}
                </tr>
              </thead>
              <tbody>
                {cargandoAdmin ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Cargando asistencias de {deporteSeleccionado}...
                    </td>
                  </tr>
                ) : registrosFiltradosCoord.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No hay asistencias registradas en estas fechas para {deporteSeleccionado}.
                    </td>
                  </tr>
                ) : (
                  registrosFiltradosCoord.map((r: any) => {
                    const al = r.alumnos;
                    const gr = al?.grupos;
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-700">{r.fecha}</td>
                        <td className="p-2.5 font-semibold text-indigo-700">{gr?.categoria}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {al?.apellido}, {al?.nombre}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.estado === 'presente'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.estado === 'tarde'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.estado}
                          </span>
                        </td>
                        {esColoniaCoord && (
                          <td className="p-2.5 text-slate-600">
                            {r.almuerzo ? '🍴 Sí' : 'No'}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // VISTA 3: PANTALLA PRINCIPAL DE PROFES
  // ==========================================
  const categoriasDelDeporte = grupos.filter((g) => g.nombre === deporteSeleccionado);
  const grupoActual = grupos.find((g) => g.id === Number(grupoSeleccionado));
  const esColonia =
    DEPORTES_OFICIALES.find((d) => d.nombre === deporteSeleccionado)?.tipo === 'colonia';
  const totalAlmuerzos = Object.values(asistencias).filter((a) => a.almuerzo).length;

  return (
    <main className="min-h-screen bg-slate-100 p-4 max-w-xl mx-auto pb-24">
      {/* Cabecera */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-slate-200">
        <div className="flex justify-between items-start mb-1">
          <div className="w-6" />
          <h1 className="text-lg font-bold text-slate-800 text-center">
            Unidad de Gestión Integral - Asistencia
          </h1>
          <button
            type="button"
            onClick={() => setVista('login_admin')}
            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
            title="Acceso Director UGI"
          >
            <ShieldAlert size={18} />
          </button>
        </div>
        <p className="text-xs text-center text-slate-500 mb-4">
          Control de Deportes y Colonia • Club Ciudad de Buenos Aires
        </p>

        <div className="space-y-3">
          {/* 1. Deporte Desbloqueado (Blindado por PIN) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-600">
                1. Deporte / Actividad habilitada:
              </label>
              <div className="flex items-center gap-3">
                {esCoordinador && (
                  <button
                    type="button"
                    onClick={() => setVista('coordinador')}
                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-semibold hover:bg-indigo-100"
                  >
                    Panel Coordinador
                  </button>
                )}
                <button
                  type="button"
                  onClick={cerrarSesionDeporte}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={12} /> Cambiar deporte / Salir
                </button>
              </div>
            </div>
            <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-sm text-blue-900 font-bold flex items-center justify-between">
              <span>{deporteSeleccionado}</span>
              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                {esColonia ? 'COLONIA' : 'DEPORTE'}
              </span>
            </div>
          </div>

          {/* 2. Selector y Editor de Categoría */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-600">
                2. Categoría / Grupo:
              </label>
              <div className="flex gap-2">
                {grupoSeleccionado && (
                  <button
                    type="button"
                    onClick={() => {
                      setModoCategoria('editar');
                      setInputCategoria(grupoActual?.categoria || '');
                    }}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Edit2 size={12} /> Editar nombre
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setModoCategoria('crear');
                    setInputCategoria('');
                  }}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 flex items-center gap-1 font-semibold"
                >
                  <Plus size={12} /> Nueva Categoría
                </button>
              </div>
            </div>

            {categoriasDelDeporte.length > 0 ? (
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
                value={grupoSeleccionado || ''}
                onChange={(e) => setGrupoSeleccionado(Number(e.target.value))}
              >
                {categoriasDelDeporte.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.categoria}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                Aún no hay categorías en <b>{deporteSeleccionado}</b>. Tocá{' '}
                <b>&quot;+ Nueva Categoría&quot;</b> arriba para crear la tuya.
              </div>
            )}

            {modoCategoria !== 'ninguno' && (
              <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ej: Sub 15, Formativa, Grupo 6 años..."
                  value={inputCategoria}
                  onChange={(e) => setInputCategoria(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={guardarCategoria}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setModoCategoria('ninguno')}
                  className="text-xs text-slate-500 px-2 py-1 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* 3. Fecha */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">3. Fecha:</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
            />
          </div>
        </div>

        {/* Resumen para Colonia */}
        {esColonia && grupoSeleccionado && (
          <div className="mt-4 p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-amber-800 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Utensils size={18} /> Almuerzos hoy:
            </span>
            <span className="text-base font-bold bg-amber-200 px-2 py-0.5 rounded">
              {totalAlmuerzos}
            </span>
          </div>
        )}
      </div>

      {/* Agregar Alumnos */}
      {grupoSeleccionado && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-xs font-bold text-slate-600 uppercase">
              Alumnos ({alumnos.length})
            </span>
            <button
              type="button"
              onClick={() => setMostrarFormAlumno(!mostrarFormAlumno)}
              className="text-xs bg-white border border-slate-300 text-slate-700 px-2.5 py-1 rounded-lg shadow-xs hover:bg-slate-50 flex items-center gap-1 font-semibold"
            >
              <UserPlus size={14} /> {mostrarFormAlumno ? 'Cerrar carga' : 'Agregar Alumno'}
            </button>
          </div>

          {mostrarFormAlumno && (
            <form
              onSubmit={agregarAlumno}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs mb-3 flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                placeholder="Apellido"
                value={nuevoApellido}
                onChange={(e) => setNuevoApellido(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                required
              />
              <input
                type="text"
                placeholder="Nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                required
              />
              <button
                type="submit"
                className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                + Sumar a la lista
              </button>
            </form>
          )}
        </div>
      )}

      {/* Lista de Alumnos */}
      <div className="space-y-2">
        {grupoSeleccionado && alumnos.length === 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            No hay alumnos cargados en <b>{grupoActual?.categoria}</b>. Tocá{' '}
            <b>&quot;Agregar Alumno&quot;</b> para armar tu lista.
          </div>
        )}

        {alumnos.map((al) => {
          const actual = asistencias[al.id] || { estado: 'presente', almuerzo: false };

          return (
            <div
              key={al.id}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700 text-sm">
                  {al.apellido}, {al.nombre}
                </span>

                <div className="flex items-center gap-2">
                  {esColonia && actual.estado !== 'ausente' && (
                    <button
                      type="button"
                      onClick={() => handleAlmuerzo(al.id)}
                      className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium border transition-colors ${
                        actual.almuerzo
                          ? 'bg-orange-500 text-white border-orange-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Utensils size={12} />
                      {actual.almuerzo ? 'Almuerza' : 'Sin Almuerzo'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => eliminarAlumno(al.id, `${al.apellido}, ${al.nombre}`)}
                    className="text-slate-300 hover:text-rose-500 p-1"
                    title="Quitar alumno"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleEstado(al.id, 'presente')}
                  className={`py-1.5 text-xs font-semibold rounded-md flex justify-center items-center gap-1 ${
                    actual.estado === 'presente'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle size={14} /> Presente
                </button>
                <button
                  type="button"
                  onClick={() => handleEstado(al.id, 'tarde')}
                  className={`py-1.5 text-xs font-semibold rounded-md flex justify-center items-center gap-1 ${
                    actual.estado === 'tarde'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Clock size={14} /> Tarde
                </button>
                <button
                  type="button"
                  onClick={() => handleEstado(al.id, 'ausente')}
                  className={`py-1.5 text-xs font-semibold rounded-md flex justify-center items-center gap-1 ${
                    actual.estado === 'ausente'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <XCircle size={14} /> Ausente
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra Flotante Inferior */}
      <div className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto p-3 bg-white border-t border-slate-200 flex gap-2">
        <button
          onClick={guardarAsistencias}
          disabled={cargando || alumnos.length === 0}
          className="flex-1 bg-blue-600 disabled:bg-slate-300 text-white py-2.5 rounded-lg text-sm font-bold shadow-xs hover:bg-blue-700 transition-colors"
        >
          {cargando ? 'Guardando...' : 'Guardar Asistencia'}
        </button>

        <button
          onClick={exportarExcelProfe}
          disabled={alumnos.length === 0}
          className="bg-emerald-600 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-xs hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          title="Descargar Excel del grupo"
        >
          <Download size={16} /> Excel
        </button>
      </div>
    </main>
  );
}