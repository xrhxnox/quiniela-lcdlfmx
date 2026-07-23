export const ACCENTS = {
  rojo: { label: "Rojo", accent: "#e30613", dim: "#7d0a10", text: "#ffffff" },
  rosa: { label: "Rosa", accent: "#ffbfde", dim: "#f0a8ce", text: "#1a1a1a" },
  amarillo: { label: "Amarillo", accent: "#f2c94c", dim: "#8a6d10", text: "#1a1a1a" },
  celeste: { label: "Celeste", accent: "#2596be", dim: "#123f52", text: "#ffffff" },
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
