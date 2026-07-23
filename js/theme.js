export const ACCENTS = {
  rojo: { label: "Rojo", accent: "#ff1f3d", dim: "#8a0e1c", text: "#ffffff" },
  celeste: { label: "Celeste", accent: "#00aaff", dim: "#0a4d73", text: "#ffffff" },
  amarillo: { label: "Amarillo", accent: "#ffd60a", dim: "#8a6d10", text: "#1a1a1a" },
  rosa: { label: "Rosa", accent: "#ffbfde", dim: "#f0a8ce", text: "#1a1a1a" },
  verde: { label: "Verde", accent: "#16d967", dim: "#0f7a3d", text: "#ffffff" },
  morado: { label: "Morado", accent: "#a742f5", dim: "#5b21b6", text: "#ffffff" },
  naranja: { label: "Naranja", accent: "#ff7a1a", dim: "#9a3412", text: "#ffffff" },
  turquesa: { label: "Turquesa", accent: "#00d9c0", dim: "#0f766e", text: "#1a1a1a" },
  blanco: { label: "Blanco", accent: "#ffffff", dim: "#c4c4c4", text: "#1a1a1a" },
};

const STORAGE_KEY = "lcdlfmx_accent";

export function getAccentKey() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return ACCENTS[saved] ? saved : "rojo";
}

export function applyAccent(key) {
  const theme = ACCENTS[key] || ACCENTS.rojo;
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-dim", theme.dim);
  root.style.setProperty("--accent-text", theme.text);
  localStorage.setItem(STORAGE_KEY, key);
}

export function initAccent() {
  applyAccent(getAccentKey());
}

// Si la cuenta ya tiene un color guardado en el servidor, ese manda
// sobre lo que haya localmente (para que se vea igual en cualquier dispositivo).
export function syncAccentFromProfile(profile) {
  if (profile?.accent_color && ACCENTS[profile.accent_color]) {
    applyAccent(profile.accent_color);
  }
}
