import { isGranja } from "./shows.js";

export const ACCENTS = {
  rojo: { label: "Rojo", accent: "#ff1f3d", dim: "#8a0e1c", text: "#ffffff" },
  celeste: { label: "Celeste", accent: "#00aaff", dim: "#0a4d73", text: "#1a1a1a" },
  amarillo: { label: "Amarillo", accent: "#e3a600", dim: "#664b00", text: "#1a1a1a" },
  rosa: { label: "Rosa", accent: "#ffbfde", dim: "#f0a8ce", text: "#1a1a1a" },
  verde: { label: "Verde", accent: "#16d967", dim: "#0f7a3d", text: "#1a1a1a" },
  morado: { label: "Morado", accent: "#a742f5", dim: "#5b21b6", text: "#ffffff" },
  naranja: { label: "Naranja", accent: "#ff7a1a", dim: "#9a3412", text: "#1a1a1a" },
  turquesa: { label: "Turquesa", accent: "#00d9c0", dim: "#0f766e", text: "#1a1a1a" },
  blanco: { label: "Blanco", accent: "#e8e8e8", dim: "#c4c4c4", text: "#1a1a1a" },
};

// Cada show guarda su propio color, tanto en el navegador como en el perfil:
// el jugador es el mismo pero puede querer La Casa en rojo y La Granja en verde.
const STORAGE_KEY = "lcdlfmx_accent";
const GRANJA_STORAGE_KEY = "lcdlfmx_accent_granja";

function storageKey() {
  return isGranja() ? GRANJA_STORAGE_KEY : STORAGE_KEY;
}

// Columna de profiles donde vive el color de este show.
export function accentField() {
  return isGranja() ? "granja_accent_color" : "accent_color";
}

export function getAccentKey() {
  const saved = localStorage.getItem(storageKey());
  if (ACCENTS[saved]) return saved;
  // La Granja arranca en verde si el jugador todavía no eligió.
  return isGranja() ? "verde" : "rojo";
}

export function applyAccent(key) {
  const theme = ACCENTS[key] || ACCENTS.rojo;
  const root = document.documentElement;
  // "Blanco" es casi invisible sobre fondo claro, así que en tema claro se muestra negro en su lugar.
  const useBlackInLight = key === "blanco" && getThemeMode() === "light";
  root.style.setProperty("--accent", useBlackInLight ? "#000000" : theme.accent);
  root.style.setProperty("--accent-dim", useBlackInLight ? "#3a3a3a" : theme.dim);
  root.style.setProperty("--accent-text", useBlackInLight ? "#ffffff" : theme.text);
  localStorage.setItem(storageKey(), key);
}

export function initAccent() {
  applyAccent(getAccentKey());
}

// Si la cuenta ya tiene un color guardado en el servidor, ese manda
// sobre lo que haya localmente (para que se vea igual en cualquier dispositivo).
export function syncAccentFromProfile(profile) {
  const saved = profile?.[accentField()];
  if (saved && ACCENTS[saved]) applyAccent(saved);
  else applyAccent(getAccentKey());
}

const THEME_MODE_KEY = "lcdlfmx_theme_mode";

export function getThemeMode() {
  return localStorage.getItem(THEME_MODE_KEY) === "light" ? "light" : "dark";
}

export function applyThemeMode(mode) {
  const value = mode === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", value);
  localStorage.setItem(THEME_MODE_KEY, value);
  applyAccent(getAccentKey());
}

export function initThemeMode() {
  applyThemeMode(getThemeMode());
}

// Igual que el color: si el perfil ya tiene un tema guardado en el servidor,
// ese manda sobre lo que haya localmente.
export function syncThemeModeFromProfile(profile) {
  if (profile?.theme_mode === "light" || profile?.theme_mode === "dark") {
    applyThemeMode(profile.theme_mode);
  }
}
