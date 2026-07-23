export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return el;
}

export function esc(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

export function clearAndAppend(container, node) {
  container.innerHTML = "";
  container.appendChild(node);
}

// Redimensiona y re-comprime una imagen en el navegador antes de subirla,
// para que las fotos de habitantes y avatares no pesen varios MB.
export function compressImage(file, { maxDimension = 800, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale) || 1;
      const height = Math.round(img.height * scale) || 1;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo comprimir la imagen"));
            return;
          }
          const baseName = file.name.replace(/\.\w+$/, "") || "foto";
          resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}
