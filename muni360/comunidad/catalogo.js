// Catálogo estático de Comunidad Muni (UTF-8).
// Para actualizar horarios habituales de entrenamiento, editá HORARIOS_ENTRENAMIENTO
// y volvé a publicar el sitio. Estos datos son públicos y no requieren base de datos.

export const ACTIVIDADES = Object.freeze([
  "Básquet Caballeros",
  "Básquet Damas",
  "COYFD",
  "Cestoball",
  "Colonia",
  "Fútbol Caballeros",
  "Fútbol Damas",
  "Gimnasia Artística",
  "Gimnasia Rítmica",
  "Golf",
  "Handball",
  "Hockey sobre Césped Caballeros",
  "Hockey sobre Césped Damas",
  "Hockey sobre Patines Caballeros",
  "Hockey sobre Patines Damas",
  "Judo",
  "Karate",
  "Natación Artística",
  "Patín Artístico",
  "Pelota Paleta",
  "Rugby Caballeros",
  "Rugby Damas",
  "Tenis",
  "Vóley Caballeros",
  "Vóley Damas"
]);

export const ACTIVIDADES_AVISOS = Object.freeze(["General", ...ACTIVIDADES]);

export const TIPOS_AVISO = Object.freeze([
  Object.freeze({ valor: "Partido", etiqueta: "Partido" }),
  Object.freeze({ valor: "Cambio", etiqueta: "Cambio" }),
  Object.freeze({ valor: "Suspension", etiqueta: "Suspensión" }),
  Object.freeze({ valor: "Aviso", etiqueta: "Aviso" })
]);

export const CATEGORIAS_SUGERIDAS = Object.freeze([
  "Escuelita",
  "Premini",
  "Mini",
  "Sub 12",
  "U13",
  "Sub 14",
  "U15",
  "Sub 16",
  "U17",
  "Sub 18",
  "Primera",
  "Todos los grupos"
]);

// Editá esta lista para modificar o sumar horarios habituales de entrenamiento.
export const HORARIOS_ENTRENAMIENTO = Object.freeze([
  Object.freeze({
    actividad: "Hockey sobre Patines Caballeros",
    categoria: "Sub 12",
    equipo: "A",
    dias: "Martes y Jueves",
    horario: "18:00 a 19:30",
    lugar: "Pista 1"
  }),
  Object.freeze({
    actividad: "Básquet Caballeros",
    categoria: "U13",
    equipo: "Tira A",
    dias: "Lunes, Miércoles y Viernes",
    horario: "17:30 a 19:00",
    lugar: "Gimnasio Norte"
  }),
  Object.freeze({
    actividad: "Colonia",
    categoria: "Todos los grupos",
    equipo: "General",
    dias: "Lunes a Viernes",
    horario: "09:00 a 17:00",
    lugar: "Sector Pileta / Playón"
  })
]);

// Clave pública VAPID opcional para Web Push externo (FCM). Completar cuando esté habilitada en Firebase Console.
export const PUSH_CONFIG = Object.freeze({
  messagingSenderId: "966447516538",
  vapidKey: "BFkYizUTTN6R2pLIA_VR5y2RXatQ5p-rJA5x1SHO8FNuuurSb7D2wr9YnaDMXGf2J47RvID7PGuYzlvGIVQLkvg"
});
