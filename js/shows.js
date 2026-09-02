// =========================================================
// Los dos shows viven en la misma app y en el mismo link.
// =========================================================
// Cada show tiene sus propias tablas en Supabase: La Casa usa las de siempre
// (participants, weeks…) y La Granja las mismas con prefijo granja_. Como la
// forma de las tablas es idéntica, todas las vistas se comparten: lo único que
// cambia es el prefijo que resuelve tbl() al construir la consulta.
//
// El show activo NO va en la URL a propósito: se pide un solo link para los
// dos, así que se guarda por navegador y se cambia con el botón de la barra.

export const SHOWS = {
  casa: {
    key: "casa",
    prefix: "",
    label: "La Casa de los Famosos MX",
    short: "LA CASA",
    icon: "fa-house",
    logo: "assets/logo-casa.png",
    // Cómo se llama a la gente dentro del show, para no decir "habitantes" en
    // La Granja ni "granjeros" en La Casa.
    memberSingular: "habitante",
    memberPlural: "Habitantes",
    leaderLabel: "Líder",
    homeLabel: "la casa",
    seasonLabel: "Temporada 4",
    scheduleHint: "El líder de la semana se publica el lunes, los nominados el miércoles y la salvación el viernes. ¡Vuelve pronto!",
    emptyHint: "Todavía no hay semanas abiertas. El líder de la semana se anuncia los lunes y los nominados se publican los miércoles.",
  },
  granja: {
    key: "granja",
    prefix: "granja_",
    label: "La Granja VIP",
    short: "LA GRANJA",
    icon: "fa-wheat-awn",
    logo: "assets/logo-granja.png",
    memberSingular: "granjero",
    memberPlural: "Granjeros",
    leaderLabel: "Capataz",
    homeLabel: "la granja",
    seasonLabel: "La Granja VIP",
    scheduleHint: "El capataz se anuncia el lunes, el duelo es el martes, la asamblea el miércoles y la salvación el jueves. ¡Vuelve pronto!",
    emptyHint: "Todavía no hay semanas abiertas. El capataz se anuncia los lunes y la asamblea de nominación es los miércoles.",
  },
};

const STORAGE_KEY = "lcdlfmx.show";
const DEFAULT_SHOW = "casa";

let current = DEFAULT_SHOW;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SHOWS[saved]) current = saved;
} catch (e) {
  // Modo privado o storage bloqueado: se queda en La Casa.
}

export function getShowKey() {
  return current;
}

export function getShow() {
  return SHOWS[current] || SHOWS[DEFAULT_SHOW];
}

export function isGranja() {
  return current === "granja";
}

export function setShow(key) {
  if (!SHOWS[key] || key === current) return false;
  current = key;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch (e) {
    // Si no se puede guardar, el cambio vale solo para esta sesión.
  }
  return true;
}

// Nombre real de la tabla, vista o función según el show activo.
// tbl("participants") -> "participants" en La Casa, "granja_participants" en La Granja.
export function tbl(name) {
  return getShow().prefix + name;
}
