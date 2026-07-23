export const ACCENTS = {
  rojo: { label: "Rojo", accent: "#e30613", dim: "#7d0a10", text: "#ffffff" },
  celeste: { label: "Celeste", accent: "#2596be", dim: "#123f52", text: "#ffffff" },
  amarillo: { label: "Amarillo", accent: "#f2c94c", dim: "#8a6d10", text: "#1a1a1a" },
  rosa: { label: "Rosa", accent: "#ffbfde", dim: "#f0a8ce", text: "#1a1a1a" },
  verde: { label: "Verde", accent: "#22c55e", dim: "#15803d", text: "#ffffff" },
  morado: { label: "Morado", accent: "#8b5cf6", dim: "#5b21b6", text: "#ffffff" },
  naranja: { label: "Naranja", accent: "#f97316", dim: "#9a3412", text: "#ffffff" },
  turquesa: { label: "Turquesa", accent: "#14b8a6", dim: "#0f766e", text: "#ffffff" },
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
